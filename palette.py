"""Official EMOTIV palettes.

These are not invented colours: they were extracted from the EMOTIV apps.

- Performance Metrics: the `performanceMetrics` table inside the EmotivPRO
  binary (/Applications/EmotivApps/EmotivPRO.app), where each colour precedes
  the metric name.
- Mental Commands: EmotivBCI assigns a colour per trained-action *slot*, not per
  action name. Confirmed in the app's own logs
  (~/Library/Application Support/Emotiv/EmotivBCI/logs/), which record lines
  like `cmd: Push color: #2ec6c8` and `cmd: Neutral color: #ff0066`, and in the
  binary (`EoTrainingAction_action_coordinates_#2ec6c8_#f2974e_#a781f3_#5ab0ee_#ff0066`).
"""
import colorsys
from typing import Dict, List, Tuple

# Cortex key (`met` stream) -> official EmotivPRO colour.
PERFORMANCE_METRIC_COLORS: Dict[str, str] = {
    "eng": "#2ec6c8",   # Engagement
    "exc": "#e9cc40",   # Excitement
    "str": "#a781f3",   # Stress
    "rel": "#5ab0ee",   # Relaxation
    "int": "#f2974e",   # Interest
    "attention": "#50e17d",   # Attention (EmotivPRO labels it Focus)
    "lex": "#404040",   # Long-term excitement (no colour of its own; reuses boredom's)
}

# EmotivBCI slot order. The first four are the app's own; the rest come from
# the EmotivPRO chart palette, for profiles with more trained actions.
MENTAL_COMMAND_SLOT_COLORS: List[str] = [
    "#2ec6c8",
    "#f2974e",
    "#a781f3",
    "#5ab0ee",
    "#e9cc40",
    "#50e17d",
    "#f75c46",
    "#bce92a",
    "#12b0da",
    "#de3d82",
    "#ffa037",
    "#ae72f9",
]

NEUTRAL_COLOR = "#ff0066"

# The metrics the app actually uses, in display order. This list is the single
# gate: a metric absent from here is neither shown nor allowed to pick a colour.
# The colour table above deliberately keeps every official entry, so re-enabling
# one is a matter of adding its key back.
PERFORMANCE_METRIC_KEYS = ["eng", "exc", "str", "int", "attention"]


def hex_to_rgb(value: str) -> Tuple[int, int, int]:
    value = value.lstrip("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


def hex_to_hsv(value: str) -> Tuple[float, float, float]:
    """#rrggbb -> (hue 0-359, sat 0-100, value 0-100)."""
    r, g, b = hex_to_rgb(value)
    h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
    return h * 359.0, s * 100.0, v * 100.0


def hsv_to_hex(hue: float, sat: float, value: float) -> str:
    r, g, b = colorsys.hsv_to_rgb((hue % 360) / 359.0, sat / 100.0, value / 100.0)
    return "#{:02x}{:02x}{:02x}".format(int(r * 255), int(g * 255), int(b * 255))


def slot_color(index: int) -> str:
    return MENTAL_COMMAND_SLOT_COLORS[index % len(MENTAL_COMMAND_SLOT_COLORS)]
