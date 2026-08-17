"""Picking the right interface for discovery.

Both brands find lights by shouting at the network — SSDP multicast for
Yeelight, UDP broadcast for LIFX — and both leave the choice of outgoing
interface to the OS. On a machine with several interfaces (VPN, Docker, a
second adapter) that default is often the wrong one, and discovery comes back
empty while the light is perfectly reachable.

So instead of trusting the default, discovery tries every local interface.
"""
import socket
from typing import List

LOOPBACK_PREFIX = "127."


def primary_ipv4() -> str:
    """The address the OS would use to reach the outside world.

    Opening a UDP socket and connecting sends nothing — it only asks the
    routing table which local address would be used. That is the interface a
    LAN light is almost certainly on.
    """
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            probe.connect(("8.8.8.8", 80))
            return probe.getsockname()[0]
        finally:
            probe.close()
    except OSError:
        return ""


def local_ipv4_addresses() -> List[str]:
    """Every usable local IPv4, primary first."""
    ordered: List[str] = []
    primary = primary_ipv4()
    if primary and not primary.startswith(LOOPBACK_PREFIX):
        ordered.append(primary)

    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            addr = info[4][0]
            if not addr.startswith(LOOPBACK_PREFIX) and addr not in ordered:
                ordered.append(addr)
    except OSError:
        pass

    return ordered


def interface_names() -> List[str]:
    """Interface names to hand to libraries that want a name, not an address."""
    try:
        return [name for _index, name in socket.if_nameindex()
                if not name.startswith("lo")]
    except (AttributeError, OSError):
        return []
