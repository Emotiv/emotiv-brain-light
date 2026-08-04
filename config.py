"""Central configuration. Everything can be overridden by env vars / .env."""
import os

from dotenv import load_dotenv

load_dotenv()


def _f(name, default):
    return float(os.getenv(name, default))


def _i(name, default):
    return int(os.getenv(name, default))


def _b(name, default):
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


class Config:
    # ---------------------------------------------------------------- Cortex
    CORTEX_URL = os.getenv("CORTEX_URL", "wss://localhost:6868")
    CORTEX_CERT_PATH = os.getenv(
        "CORTEX_CERT_PATH",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "certificates", "rootCA.pem"),
    )
    # Credentials: .env (CORTEX_CLIENT_ID/SECRET) or the file already used by
    # emotiv-brain-music (~/.emotiv_bridge/cortex_creds.json).
    CORTEX_CLIENT_ID = os.getenv("CORTEX_CLIENT_ID")
    CORTEX_CLIENT_SECRET = os.getenv("CORTEX_CLIENT_SECRET")
    CORTEX_CREDS_PATH = os.path.expanduser(
        os.getenv("CORTEX_CREDS_PATH", "~/.emotiv_bridge/cortex_creds.json")
    )
    # Specific headset; empty = fall back to the first one found.
    HEADSET_ID = os.getenv("HEADSET_ID", "")

    # ----------------------------------------------------------------- Bulb
    BULB_IP = os.getenv("BULB_IP", "192.168.3.154")
    BULB_PORT = _i("BULB_PORT", 55443)
    # This machine's LAN IP, for music mode (the bulb connects back to us).
    # Empty = let the library discover it.
    HOST_IP = os.getenv("HOST_IP", "")
    RENDER_FPS = _f("RENDER_FPS", 25.0)
    # Reconnect backoff ceiling. Hammering a wedged bulb only makes it worse —
    # it accepts very few simultaneous TCP connections.
    RECONNECT_MAX_DELAY = _f("RECONNECT_MAX_DELAY", 60.0)
    # Interpolation time constant, in seconds. Higher = slower and smoother.
    SMOOTH_TAU = _f("SMOOTH_TAU", 0.45)

    BRIGHT_MIN = _f("BRIGHT_MIN", 12.0)
    BRIGHT_MAX = _f("BRIGHT_MAX", 100.0)
    SAT_MIN = _f("SAT_MIN", 55.0)
    SAT_MAX = _f("SAT_MAX", 100.0)

    # -------------------------------------------------------------- Mapping
    # "adaptive" = z-score against the person's own baseline (recommended).
    # "raw"      = compare the raw 0..1 values against each other.
    SCORE_MODE = os.getenv("SCORE_MODE", "adaptive")
    # Half-life of the adaptive baseline, in seconds.
    BASELINE_HALFLIFE = _f("BASELINE_HALFLIFE", 60.0)
    # Minimum samples before trusting the baseline.
    BASELINE_WARMUP = _i("BASELINE_WARMUP", 20)
    # Switching the leading metric: it must win by this margin...
    SWITCH_MARGIN = _f("SWITCH_MARGIN", 0.06)
    # ...and hold that lead for this long (seconds).
    SWITCH_HOLD = _f("SWITCH_HOLD", 0.8)
    # Metrics to ignore (csv). lex = long-term excitement, far too slow.
    IGNORE_METRICS = [m.strip() for m in os.getenv("IGNORE_METRICS", "lex").split(",") if m.strip()]

    VERBOSE = _b("VERBOSE", True)
