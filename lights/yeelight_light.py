"""Yeelight transport (JSON over TCP 55443).

Yeelight rate-limits normal commands to roughly 60 per minute, which is far
below what a smooth fade needs. `start_music()` lifts that: it swaps the link
for a reverse one, where the bulb connects back to this machine.
"""
import time
from typing import Optional

from yeelight import Bulb, BulbException, discover_bulbs

from .base import LightError, LightTransport
from .net import interface_names


class YeelightTransport(LightTransport):
    brand = "yeelight"
    # Music mode removes the limit, so the ceiling is ours, not the protocol's.
    max_updates_per_second = 25.0

    def __init__(self, ip: str, port: int = 55443, host_ip: Optional[str] = None):
        super().__init__(ip)
        self.port = port
        self.host_ip = host_ip
        self.bulb: Optional[Bulb] = None
        self._sent_hue: Optional[int] = None
        self._sent_sat: Optional[int] = None
        self._sent_bright: Optional[int] = None

    def connect(self) -> None:
        # One connection per process: the bulb accepts very few simultaneous
        # TCP connections and starts timing out if we open several.
        bulb = Bulb(self.ip, port=self.port, effect="sudden", duration=0, auto_on=True)

        try:
            props = bulb.get_properties()
        except Exception as e:
            raise LightError("err.bulb_unreachable", ip=self.ip, detail=str(e))

        if props.get("power") != "on":
            bulb.turn_on()

        try:
            bulb.start_music(ip=self.host_ip or None)
        except BulbException as e:
            # -5000 is almost always an orphaned music session: a previous
            # process died without closing it and the bulb still thinks it is in
            # one. Clear it so the caller's retry can succeed.
            if "-5000" in str(e) or "general error" in str(e):
                try:
                    bulb.stop_music()
                except Exception:
                    pass
                time.sleep(2.0)
                raise LightError("err.bulb_music_busy", ip=self.ip)
            raise LightError("err.bulb_unreachable", ip=self.ip, detail=str(e))

        self.bulb = bulb
        self._sent_hue = self._sent_sat = self._sent_bright = None

    def apply(self, hue: float, sat: float, bright: float) -> None:
        if not self.bulb:
            return

        h = int(round(hue)) % 360
        s = int(round(max(0.0, min(100.0, sat))))
        b = int(round(max(1.0, min(100.0, bright))))

        try:
            # set_hsv with a `value` turns into a colour flow in the library, so
            # hue and brightness go separately to keep at most two short
            # commands per frame.
            if self._sent_hue is None or abs(h - self._sent_hue) >= 1 or \
               self._sent_sat is None or abs(s - self._sent_sat) >= 1:
                self.bulb.set_hsv(h, s, None, effect="sudden", duration=0)
                self._sent_hue, self._sent_sat = h, s

            if self._sent_bright is None or abs(b - self._sent_bright) >= 1:
                self.bulb.set_brightness(b, effect="sudden", duration=0)
                self._sent_bright = b
        except (BulbException, OSError) as e:
            raise LightError("err.bulb_unreachable", ip=self.ip, detail=str(e))

    def close(self) -> None:
        if self.bulb:
            try:
                self.bulb.stop_music()
            except Exception:
                pass
        self.bulb = None

    @staticmethod
    def discover(timeout: float = 3.0) -> Optional[str]:
        # The default route is not always the one the bulb is on, and the
        # library leaves the multicast interface to the OS. Ask the default
        # first, then every interface by name.
        attempts = [None] + interface_names()
        per_try = max(1, int(timeout / max(1, len(attempts))))
        for interface in attempts:
            try:
                bulbs = discover_bulbs(timeout=per_try, interface=interface or False)
            except Exception:
                # Interfaces with no IPv4 (utun, bridges) make the library raise
                # rather than skip them. Not a reason to abandon the search.
                continue
            if bulbs:
                return bulbs[0]["ip"]
        return None
