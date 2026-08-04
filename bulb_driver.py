"""Yeelight YLDP06YL driver with music mode and smooth interpolation.

Cortex delivers `met` at ~2 Hz. Sending that straight to the bulb produces
visible colour jumps, and even at 2 Hz Yeelight's default rate limit
(~60 cmd/min) would be blown. So: `start_music()` removes the limit (the bulb
opens a reverse TCP connection back to us) and a render thread interpolates the
current state toward the target at RENDER_FPS frames per second.
"""
import math
import threading
import time
from typing import Optional, Tuple

from yeelight import Bulb, BulbException, discover_bulbs

from config import Config
from settings import settings


def shortest_hue_step(current: float, target: float, alpha: float) -> float:
    """Step around the hue circle the short way (avoids sweeping the rainbow)."""
    delta = (target - current + 540.0) % 360.0 - 180.0
    return (current + delta * alpha) % 360.0


class SmoothBulb:
    """Any thread writes the target; the render thread chases it."""

    def __init__(self, ip: Optional[str] = None):
        self.ip = ip or Config.BULB_IP
        self.bulb: Optional[Bulb] = None

        self._lock = threading.Lock()
        self._target: Tuple[float, float, float] = (210.0, 80.0, 40.0)  # hue, sat, bright
        self._current = list(self._target)

        # Last state actually sent, so we never repeat a command.
        self._sent_hue: Optional[int] = None
        self._sent_sat: Optional[int] = None
        self._sent_bright: Optional[int] = None

        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None

    # ------------------------------------------------------------- connection
    def connect(self, attempts: int = 5):
        """Open the LAN connection and enter music mode, with retries."""
        last_error = None
        for i in range(attempts):
            try:
                self._connect_once()
                return
            except Exception as e:
                last_error = e
                wait = min(3.0 * (i + 1), 10.0)
                print(f"[bulb] attempt {i + 1}/{attempts} failed ({e}); retrying in {wait:.0f}s")
                time.sleep(wait)
        raise last_error

    def _connect_once(self):
        # One connection per process: the bulb accepts very few simultaneous
        # TCP connections and starts timing out if we open several.
        bulb = Bulb(self.ip, port=Config.BULB_PORT, effect="sudden", duration=0, auto_on=True)

        props = bulb.get_properties()
        print(f"[bulb] {self.ip} connected. power={props.get('power')} bright={props.get('bright')}")

        if props.get("power") != "on":
            bulb.turn_on()

        try:
            bulb.start_music(ip=Config.HOST_IP or None)
        except BulbException as e:
            # -5000 here is almost always an orphaned music session: a previous
            # process died without closing it and the bulb still thinks it is in
            # one. Clear it and let the retry loop rebuild the connection.
            if "-5000" in str(e) or "general error" in str(e):
                print("[bulb] orphaned music session detected; clearing it...")
                try:
                    bulb.stop_music()
                except Exception:
                    pass
                time.sleep(2.0)
            raise

        self.bulb = bulb
        print("[bulb] music mode active (no rate limit).")

    def _reconnect(self):
        print("[bulb] reconnecting...")
        self.bulb = None
        self._sent_hue = self._sent_sat = self._sent_bright = None

        # Exponential backoff: when the bulb wedges, retrying every 5s just
        # stacks connection on connection and sinks it for good. Better to wait.
        delay = 5.0
        while not self._stop.is_set():
            try:
                self._connect_once()
                return
            except Exception as e:
                print(f"[bulb] reconnect failed ({e}); retrying in {delay:.0f}s")
                self._stop.wait(delay)
                delay = min(delay * 2.0, Config.RECONNECT_MAX_DELAY)

    # ---------------------------------------------------------------- target
    def set_target(self, hue: float, sat: float, bright: float):
        with self._lock:
            self._target = (hue % 360.0, sat, bright)

    # ---------------------------------------------------------------- render
    def start(self):
        self._thread = threading.Thread(target=self._render_loop, name="bulb-render", daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2.0)
        try:
            if self.bulb:
                self.bulb.stop_music()
        except Exception:
            pass

    def _render_loop(self):
        period = 1.0 / Config.RENDER_FPS
        last = time.monotonic()

        while not self._stop.is_set():
            now = time.monotonic()
            dt = now - last
            last = now

            # Exponential smoothing: regardless of FPS, it converges with the
            # time constant the user chose.
            try:
                tau = float(settings.get("smooth_tau"))
            except (TypeError, ValueError):
                tau = Config.SMOOTH_TAU
            alpha = 1.0 - math.exp(-dt / max(tau, 1e-3))

            with self._lock:
                t_hue, t_sat, t_bright = self._target

            self._current[0] = shortest_hue_step(self._current[0], t_hue, alpha)
            self._current[1] += (t_sat - self._current[1]) * alpha
            self._current[2] += (t_bright - self._current[2]) * alpha

            try:
                self._push()
            except BulbException as e:
                print(f"[bulb] send error: {e}")
                self._reconnect()
            except OSError as e:
                print(f"[bulb] socket error: {e}")
                self._reconnect()

            self._stop.wait(max(0.0, period - (time.monotonic() - now)))

    def _push(self):
        """Send only what changed enough to be visible."""
        if not self.bulb:
            return

        hue = int(round(self._current[0])) % 360
        sat = int(round(max(0.0, min(100.0, self._current[1]))))
        bright = int(round(max(1.0, min(100.0, self._current[2]))))

        # set_hsv with `value` turns into a colour flow in the library; we send
        # hue and brightness separately to keep at most two short commands per
        # frame.
        hue_changed = self._sent_hue is None or abs(hue - self._sent_hue) >= 1
        sat_changed = self._sent_sat is None or abs(sat - self._sent_sat) >= 1
        if hue_changed or sat_changed:
            self.bulb.set_hsv(hue, sat, None, effect="sudden", duration=0)
            self._sent_hue, self._sent_sat = hue, sat

        if self._sent_bright is None or abs(bright - self._sent_bright) >= 1:
            self.bulb.set_brightness(bright, effect="sudden", duration=0)
            self._sent_bright = bright


def find_bulb_ip(timeout: int = 3) -> Optional[str]:
    """Discover the first Yeelight on the LAN via SSDP."""
    bulbs = discover_bulbs(timeout=timeout)
    if not bulbs:
        return None
    for b in bulbs:
        print(f"[bulb] found {b['ip']} model={b['capabilities'].get('model')}")
    return bulbs[0]["ip"]
