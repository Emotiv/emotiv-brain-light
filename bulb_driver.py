"""Brand-agnostic smoothing loop that drives whichever light is configured.

Cortex delivers `met` at ~2 Hz. Sending that straight through produces visible
colour jumps, so a render thread interpolates the current state toward the
target and hands each frame to a transport from `lights/`.

Everything brand-specific — how to reach the light, how to paint one value —
lives in that package. What stays here is the part every brand shares:
easing, hue wrap-around, change throttling and reconnect backoff.
"""
import math
import threading
import time
from typing import Optional, Tuple

from config import Config
from lights import LightError, LightTransport, create_transport, discover
from settings import settings


def shortest_hue_step(current: float, target: float, alpha: float) -> float:
    """Step around the hue circle the short way (avoids sweeping the rainbow)."""
    delta = (target - current + 540.0) % 360.0 - 180.0
    return (current + delta * alpha) % 360.0


class SmoothBulb:
    """Any thread writes the target; the render thread chases it."""

    def __init__(self, ip: Optional[str] = None, brand: Optional[str] = None):
        self.ip = ip or settings.get("bulb_ip") or Config.BULB_IP
        self.brand = brand or settings.get("light_brand") or ""
        self.transport: Optional[LightTransport] = None

        self._lock = threading.Lock()
        self._target: Tuple[float, float, float] = (210.0, 80.0, 40.0)  # hue, sat, bright
        self._current = list(self._target)

        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None

    @property
    def fps(self) -> float:
        """Never outrun what the protocol tolerates, whatever RENDER_FPS says."""
        ceiling = self.transport.max_updates_per_second if self.transport else Config.RENDER_FPS
        return max(1.0, min(Config.RENDER_FPS, ceiling))

    # ------------------------------------------------------------- connection
    def connect(self, attempts: int = 5) -> None:
        """Open the link, with retries."""
        last_error: Optional[Exception] = None
        for i in range(attempts):
            try:
                self._connect_once()
                return
            except Exception as e:
                last_error = e
                wait = min(3.0 * (i + 1), 10.0)
                print(f"[light] attempt {i + 1}/{attempts} failed ({e}); retrying in {wait:.0f}s")
                time.sleep(wait)
        raise last_error

    def _connect_once(self) -> None:
        transport = create_transport(self.brand, self.ip)
        transport.connect()
        self.transport = transport
        print(f"[light] {self.brand} at {self.ip} ready ({self.fps:.0f} fps ceiling)")

    def _reconnect(self) -> None:
        print("[light] reconnecting...")
        if self.transport:
            try:
                self.transport.close()
            except Exception:
                pass
        self.transport = None

        # Exponential backoff: when a light wedges, retrying every few seconds
        # just stacks connection on connection. Better to wait.
        delay = 5.0
        while not self._stop.is_set():
            try:
                self._connect_once()
                return
            except Exception as e:
                print(f"[light] reconnect failed ({e}); retrying in {delay:.0f}s")
                self._stop.wait(delay)
                delay = min(delay * 2.0, Config.RECONNECT_MAX_DELAY)

    # ------------------------------------------------------------------ target
    def set_target(self, hue: float, sat: float, bright: float) -> None:
        with self._lock:
            self._target = (hue % 360.0, sat, bright)

    # ------------------------------------------------------------------ render
    def start(self) -> None:
        self._thread = threading.Thread(target=self._render_loop, name="light-render", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2.0)
        if self.transport:
            try:
                self.transport.close()
            except Exception:
                pass
        self.transport = None

    def _render_loop(self) -> None:
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
                if self.transport:
                    self.transport.apply(*self._current)
            except (LightError, OSError) as e:
                print(f"[light] send error: {e}")
                self._reconnect()

            period = 1.0 / self.fps
            self._stop.wait(max(0.0, period - (time.monotonic() - now)))


def find_bulb_ip(brand: str = "", timeout: float = 3.0) -> Optional[str]:
    """Discover the first light of the configured brand on the LAN."""
    brand = brand or settings.get("light_brand") or ""
    ip = discover(brand, timeout)
    if ip:
        print(f"[light] found {brand or 'light'} at {ip}")
    return ip
