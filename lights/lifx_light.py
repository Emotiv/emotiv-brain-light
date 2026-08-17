"""LIFX transport (LIFX LAN protocol, binary over UDP 56700).

Written straight against the protocol rather than through a library: the app
only needs three message types, and a hand-rolled encoder keeps an extra
dependency out of the packaged build.

Layout follows lan.developer.lifx.com — 36-byte header, everything
little-endian:

    Frame          size u16 | protocol+flags u16 | source u32          (8)
    Frame Address  target 8B | reserved 6B | flags u8 | sequence u8   (16)
    Proto Header   reserved 8B | pkt_type u16 | reserved u16          (12)
"""
import random
import socket
import struct
import time
from typing import Optional, Tuple

from .base import LightError, LightTransport
from .net import local_ipv4_addresses

PORT = 56700
HEADER_SIZE = 36

# Message types used here.
GET_SERVICE = 2
STATE_SERVICE = 3
SET_LIGHT_POWER = 117
SET_COLOR = 102

BROADCAST_TARGET = b"\x00" * 8
POWER_ON = 65535
# Kelvin is ignored while saturation is high, which is where this app lives.
# It still has to be a sane value for the moments the colour washes out.
DEFAULT_KELVIN = 3500


def _header(pkt_type: int, payload_len: int, target: bytes = BROADCAST_TARGET,
            tagged: bool = False, source: int = 0, sequence: int = 0) -> bytes:
    size = HEADER_SIZE + payload_len
    # protocol occupies the low 12 bits; addressable is always 1; origin is 0.
    protocol = 1024 | (1 << 12) | ((1 << 13) if tagged else 0)
    frame = struct.pack("<HHI", size, protocol, source)
    # res_required and ack_required both off: colour updates are fire-and-forget,
    # and asking for replies at frame rate would only add traffic.
    frame_address = target[:8].ljust(8, b"\x00") + b"\x00" * 6 + struct.pack("<BB", 0, sequence)
    protocol_header = b"\x00" * 8 + struct.pack("<HH", pkt_type, 0)
    return frame + frame_address + protocol_header


def _parse_header(data: bytes) -> Optional[Tuple[int, bytes]]:
    """Return (pkt_type, target) or None when the datagram is too short."""
    if len(data) < HEADER_SIZE:
        return None
    target = data[8:16]
    (pkt_type,) = struct.unpack_from("<H", data, 32)
    return pkt_type, target


class LifxTransport(LightTransport):
    brand = "lifx"
    # The protocol documentation puts the ceiling at 20 messages per second per
    # device; going above it risks undefined behaviour.
    max_updates_per_second = 20.0

    def __init__(self, ip: str, port: int = PORT):
        super().__init__(ip)
        self.port = port
        self.sock: Optional[socket.socket] = None
        self.target = BROADCAST_TARGET
        self.source = random.randint(2, 0xFFFFFFFF)
        self._sequence = 0
        self._sent: Optional[Tuple[int, int, int]] = None
        # One SetColor carries the whole HSBK, and its duration field lets the
        # light interpolate between our frames instead of stepping.
        self._duration_ms = int(1000 / self.max_updates_per_second)

    def _next_sequence(self) -> int:
        self._sequence = (self._sequence + 1) % 256
        return self._sequence

    def _send(self, pkt_type: int, payload: bytes = b"", target: Optional[bytes] = None,
              tagged: bool = False, addr: Optional[Tuple[str, int]] = None) -> None:
        if not self.sock:
            raise LightError("err.bulb_unreachable", ip=self.ip)
        packet = _header(pkt_type, len(payload), target if target is not None else self.target,
                         tagged, self.source, self._next_sequence()) + payload
        self.sock.sendto(packet, addr or (self.ip, self.port))

    def connect(self) -> None:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.settimeout(2.0)
        self.sock = sock
        self._sent = None

        # GetService doubles as a reachability probe and as the way to learn the
        # device's MAC, which every later packet is addressed to.
        found = False
        for _ in range(3):
            try:
                self._send(GET_SERVICE, target=BROADCAST_TARGET)
                data, _addr = sock.recvfrom(1024)
            except socket.timeout:
                continue
            except OSError as e:
                self.close()
                raise LightError("err.bulb_unreachable", ip=self.ip, detail=str(e))
            parsed = _parse_header(data)
            if parsed and parsed[0] == STATE_SERVICE:
                self.target = parsed[1]
                found = True
                break

        if not found:
            self.close()
            raise LightError("err.bulb_unreachable", ip=self.ip,
                             detail="no StateService reply on UDP 56700")

        # Turn on with a short fade so a dark light does not snap to full.
        self._send(SET_LIGHT_POWER, struct.pack("<HI", POWER_ON, 400))

    def apply(self, hue: float, sat: float, bright: float) -> None:
        if not self.sock:
            return

        # LIFX takes HSBK as 16-bit fields across the full range.
        h = int(round((hue % 360.0) / 360.0 * 65535.0)) & 0xFFFF
        s = int(round(max(0.0, min(100.0, sat)) / 100.0 * 65535.0)) & 0xFFFF
        b = int(round(max(0.0, min(100.0, bright)) / 100.0 * 65535.0)) & 0xFFFF

        # 16-bit steps are far finer than the eye; skip frames that changed by
        # less than roughly a quarter percent to keep the packet rate honest.
        if self._sent is not None:
            ph, ps, pb = self._sent
            if abs(h - ph) < 160 and abs(s - ps) < 160 and abs(b - pb) < 160:
                return

        payload = struct.pack("<BHHHHI", 0, h, s, b, DEFAULT_KELVIN, self._duration_ms)
        try:
            self._send(SET_COLOR, payload)
        except OSError as e:
            raise LightError("err.bulb_unreachable", ip=self.ip, detail=str(e))
        self._sent = (h, s, b)

    def close(self) -> None:
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
        self.sock = None

    @staticmethod
    def discover(timeout: float = 3.0) -> Optional[str]:
        """Broadcast GetService and return the first responder's address.

        Sent once per local interface: leaving the choice to the OS misses the
        light whenever the default route is not the LAN the light is on.
        """
        sources = local_ipv4_addresses() or [""]
        budget = max(0.8, timeout / len(sources))

        for local_ip in sources:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            sock.settimeout(0.5)
            packet = _header(GET_SERVICE, 0, BROADCAST_TARGET, tagged=True,
                             source=random.randint(2, 0xFFFFFFFF))
            try:
                if local_ip:
                    sock.bind((local_ip, 0))
                deadline = time.monotonic() + budget
                while time.monotonic() < deadline:
                    sock.sendto(packet, ("255.255.255.255", PORT))
                    try:
                        data, addr = sock.recvfrom(1024)
                    except socket.timeout:
                        continue
                    parsed = _parse_header(data)
                    if parsed and parsed[0] == STATE_SERVICE:
                        return addr[0]
            except OSError:
                continue
            finally:
                sock.close()
        return None
