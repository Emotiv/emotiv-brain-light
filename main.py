"""Command-line mode — handy for testing the bulb without opening the UI.

For normal use, run `app.py`.
"""
import argparse
import asyncio
import math
import random
import signal
import sys
import time

from bulb_driver import SmoothBulb, find_bulb_ip
from config import Config
from cortex_client import CortexClient
from mapping import PerformanceMetricsMapper
from palette import PERFORMANCE_METRIC_KEYS
from settings import settings


class Bridge:
    def __init__(self, bulb: SmoothBulb):
        self.bulb = bulb
        self.mapper = PerformanceMetricsMapper(Config)
        self._last_log = 0.0

    def on_metrics(self, values, active):
        target = self.mapper.update(values, active)
        if not target:
            return
        self.bulb.set_target(target.hue, target.sat, target.bright)

        now = time.monotonic()
        if now - self._last_log >= 1.0:
            self._last_log = now
            scores = target.detail.get("scores", {})
            ranking = " ".join(f"{k}={v:.2f}" for k, v in sorted(scores.items(), key=lambda kv: -kv[1]))
            print(
                f"[map] {target.label:<4} {target.color} "
                f"hue={target.hue:3.0f} sat={target.sat:3.0f} bri={target.bright:3.0f} | {ranking}"
            )


async def amain(args):
    ip = args.ip or settings.get("bulb_ip") or Config.BULB_IP
    if args.discover or not ip:
        print("[bulb] scanning the LAN for bulbs...")
        ip = find_bulb_ip()
        if not ip:
            print("No Yeelight found. Check LAN Control in the Xiaomi Home app.")
            return 1

    bulb = SmoothBulb(ip)
    try:
        bulb.connect()
    except Exception as e:
        print(f"Could not connect to {ip}: {e}")
        print(
            "Check: no other instance running (ps aux | grep main.py), LAN Control "
            "enabled, same network, and the macOS firewall allowing inbound "
            "connections."
        )
        return 1

    bulb.start()
    bridge = Bridge(bulb)

    try:
        if args.demo:
            await run_demo(bridge)
        else:
            client = CortexClient(lambda event, data: print(f"[{event}] {data}"))
            client.on_metrics = bridge.on_metrics
            await client.run(
                settings.get("client_id") or "", settings.get("client_secret") or ""
            )
    except (asyncio.CancelledError, KeyboardInterrupt):
        pass
    finally:
        # Without this the bulb keeps believing it is in music mode.
        bulb.stop()
    return 0


async def run_demo(bridge: Bridge):
    """Runs without a headset, on synthetic metrics."""
    print("[demo] generating synthetic metrics (Ctrl+C to quit)")
    names = list(PERFORMANCE_METRIC_KEYS)
    phase = {n: random.random() * 6.28 for n in names}
    t = 0.0
    while True:
        values = {n: 0.5 + 0.45 * math.sin(t * (0.2 + 0.05 * i) + phase[n]) for i, n in enumerate(names)}
        bridge.on_metrics(values, {n: True for n in names})
        await asyncio.sleep(0.5)
        t += 0.5


def main():
    parser = argparse.ArgumentParser(description="EEG (Cortex) -> Yeelight, CLI mode")
    parser.add_argument("--ip", help="bulb IP address")
    parser.add_argument("--discover", action="store_true", help="find the bulb via SSDP")
    parser.add_argument("--demo", action="store_true", help="run without a headset")
    args = parser.parse_args()

    # SIGTERM must also pass through the finally that closes music mode.
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))

    try:
        return asyncio.run(amain(args))
    except KeyboardInterrupt:
        print("\nshutting down.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
