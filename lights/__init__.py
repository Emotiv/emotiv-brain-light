"""Registry of supported light brands.

Adding a brand means adding a transport module and one entry here — nothing in
the engine, the mapping or the UI logic is brand-aware.
"""
from typing import Dict, List, Optional, Type

from config import Config

from .base import LightError, LightTransport
from .lifx_light import LifxTransport
from .yeelight_light import YeelightTransport

BRANDS: Dict[str, Type[LightTransport]] = {
    YeelightTransport.brand: YeelightTransport,
    LifxTransport.brand: LifxTransport,
}

DEFAULT_BRAND = YeelightTransport.brand


def brand_names() -> List[str]:
    return list(BRANDS.keys())


def transport_class(brand: str) -> Type[LightTransport]:
    return BRANDS.get(brand or DEFAULT_BRAND, BRANDS[DEFAULT_BRAND])


def create_transport(brand: str, ip: str) -> LightTransport:
    cls = transport_class(brand)
    if cls is YeelightTransport:
        return cls(ip, port=Config.BULB_PORT, host_ip=Config.HOST_IP or None)
    return cls(ip)


def discover(brand: str, timeout: float = 3.0) -> Optional[str]:
    return transport_class(brand).discover(timeout)


__all__ = [
    "BRANDS",
    "DEFAULT_BRAND",
    "LightError",
    "LightTransport",
    "brand_names",
    "create_transport",
    "discover",
    "transport_class",
]
