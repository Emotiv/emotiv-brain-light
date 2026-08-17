"""What every light brand has to provide.

The smoothing loop, the reconnect backoff and the target handling live in
`bulb_driver.SmoothBulb` and are shared. A transport only has to know how to
reach one brand and how to paint a single HSV value.
"""
from abc import ABC, abstractmethod
from typing import Optional


class LightError(Exception):
    """Failure carrying a translation code, so the engine stays brand-agnostic.

    Without this the engine would have to recognise vendor error strings —
    it used to match Yeelight's "-5000" by hand.
    """

    def __init__(self, code: str = "err.bulb_unreachable", **params):
        super().__init__(code)
        self.code = code
        self.params = params


class LightTransport(ABC):
    #: Identifier stored in settings and shown in the picker.
    brand: str = ""
    #: Ceiling the protocol tolerates. The render loop never sends faster than
    #: this, no matter what RENDER_FPS says.
    max_updates_per_second: float = 25.0

    def __init__(self, ip: str):
        self.ip = ip

    @abstractmethod
    def connect(self) -> None:
        """Open the link and leave the light ready to receive colours.

        Raises LightError with a translatable code on failure.
        """

    @abstractmethod
    def apply(self, hue: float, sat: float, bright: float) -> None:
        """Paint one HSV sample. hue 0-360, sat 0-100, bright 0-100.

        Called once per render frame, so implementations should skip the write
        when nothing changed enough to be visible.
        """

    @abstractmethod
    def close(self) -> None:
        """Release the light. Must be safe to call when never connected."""

    @staticmethod
    @abstractmethod
    def discover(timeout: float = 3.0) -> Optional[str]:
        """Return the IP of the first light of this brand on the LAN."""
