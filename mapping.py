"""Cortex data -> HSV target for the bulb.

Two modes:

- Performance Metrics: the strongest metric right now picks the colour (official
  EmotivPRO palette), its intensity sets the brightness, and its lead over the
  runner-up sets the saturation.
- Mental Commands: the detected action picks the colour (slot colour, as in
  EmotivBCI) and the detection strength sets the brightness.
"""
import math
import time
from typing import Dict, List, Optional, Tuple

from palette import (
    NEUTRAL_COLOR,
    PERFORMANCE_METRIC_COLORS,
    PERFORMANCE_METRIC_KEYS,
    hex_to_hsv,
    slot_color,
)
from settings import settings


def clamp(x: float, lo: float, hi: float) -> float:
    return lo if x < lo else hi if x > hi else x


class Target:
    """An HSV target plus the context the UI needs to display."""

    def __init__(self, hue: float, sat: float, bright: float, label: str, color: str, detail=None):
        self.hue = hue
        self.sat = sat
        self.bright = bright
        self.label = label      # raw key (e.g. "foc", "push") — the UI translates it
        self.color = color      # official hex, for the UI swatch
        self.detail = detail or {}

    def as_dict(self):
        return {
            "hue": round(self.hue, 1),
            "sat": round(self.sat, 1),
            "bright": round(self.bright, 1),
            "label": self.label,
            "color": self.color,
            **self.detail,
        }


class RunningBaseline:
    """Exponential mean and standard deviation of one metric.

    Raw Cortex values sit in a narrow band that differs per metric (rel tends to
    run high, exc low), so comparing raw values lets one metric win almost
    always. Here each metric becomes a z-score against the user's own baseline —
    "strongest" comes to mean "most elevated relative to its own normal".
    """

    def __init__(self, halflife: float, warmup: int):
        self.halflife = max(halflife, 1e-3)
        self.warmup = warmup
        self.mean = 0.0
        self.var = 0.0
        self.n = 0
        self._last_t: Optional[float] = None

    def update(self, x: float, now: float) -> float:
        dt = 0.5 if self._last_t is None else max(now - self._last_t, 1e-3)
        self._last_t = now
        alpha = 1.0 - math.pow(0.5, dt / self.halflife)

        if self.n == 0:
            self.mean, self.var = x, 0.0
        else:
            delta = x - self.mean
            self.mean += alpha * delta
            self.var = (1 - alpha) * (self.var + alpha * delta * delta)
        self.n += 1

        if self.n < self.warmup:
            # Still warming up: use the raw value, which is already 0..1.
            return clamp(x, 0.0, 1.0)

        std = math.sqrt(self.var)
        if std < 1e-4:
            return 0.5
        return clamp(0.5 + (x - self.mean) / std / 4.0, 0.0, 1.0)


class PerformanceMetricsMapper:
    def __init__(self, config):
        self.config = config
        self.baselines: Dict[str, RunningBaseline] = {}
        self.leader: Optional[str] = None
        self._candidate: Optional[str] = None
        self._candidate_since = 0.0

    def reset(self):
        self.baselines.clear()
        self.leader = None
        self._candidate = None

    def _score(self, name: str, value: float, now: float) -> float:
        if settings.get("score_mode") == "raw":
            return clamp(value, 0.0, 1.0)
        if name not in self.baselines:
            self.baselines[name] = RunningBaseline(
                self.config.BASELINE_HALFLIFE, self.config.BASELINE_WARMUP
            )
        return self.baselines[name].update(value, now)

    def update(self, values: Dict[str, float], active: Dict[str, bool]) -> Optional[Target]:
        now = time.monotonic()

        scores: Dict[str, float] = {}
        for name, value in values.items():
            if name in self.config.IGNORE_METRICS or name not in PERFORMANCE_METRIC_KEYS:
                continue
            if active.get(name, True) is False:
                continue
            scores[name] = self._score(name, value, now)

        if not scores:
            return None

        ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
        top_name, top_score = ranked[0]
        runner_up = ranked[1][1] if len(ranked) > 1 else 0.0

        # Hysteresis: the challenger must lead by SWITCH_MARGIN and hold that
        # lead for SWITCH_HOLD seconds. Without it the bulb flickers between two
        # metrics sitting at a tie.
        if self.leader is None or self.leader not in scores:
            # No leader yet, or the leader went inactive: take over at once.
            self.leader = top_name
            self._candidate = None
        elif top_name != self.leader:
            if top_score > scores.get(self.leader, 0.0) + self.config.SWITCH_MARGIN:
                if self._candidate != top_name:
                    self._candidate = top_name
                    self._candidate_since = now
                elif now - self._candidate_since >= self.config.SWITCH_HOLD:
                    self.leader = top_name
                    self._candidate = None
            else:
                self._candidate = None
        else:
            self._candidate = None

        leader_score = scores.get(self.leader, top_score)
        color = PERFORMANCE_METRIC_COLORS[self.leader]
        hue, color_sat, _ = hex_to_hsv(color)

        bright_min = float(settings.get("bright_min"))
        bright_max = float(settings.get("bright_max"))
        sat_min = float(settings.get("sat_min"))

        bright = bright_min + leader_score * (bright_max - bright_min)

        # A near-tie washes the colour out; a clear lead keeps it fully saturated.
        margin = clamp((top_score - runner_up) / 0.25, 0.0, 1.0)
        sat = sat_min + margin * (color_sat - sat_min) if color_sat > sat_min else color_sat

        return Target(
            hue,
            sat,
            bright,
            self.leader,
            color,
            {"scores": {k: round(v, 3) for k, v in scores.items()},
             "raw": {k: round(v, 3) for k, v in values.items()}},
        )


class MentalCommandMapper:
    """The detected action picks the colour; detection strength sets brightness.

    Colours follow EmotivBCI: they are assigned by the action's position in the
    profile's trained-action list, not by its name. That is why `set_actions()`
    must be called with the order Cortex returns from
    `mentalCommandActiveAction`.
    """

    def __init__(self, config):
        self.config = config
        self.actions: List[str] = []
        self.colors: Dict[str, str] = {}
        self.last_action = "neutral"
        self.last_power = 0.0

    def set_actions(self, actions: List[str]):
        # `neutral` always exists and has a fixed colour; it uses no slot.
        self.actions = [a for a in actions if a != "neutral"]
        self.colors = {a: slot_color(i) for i, a in enumerate(self.actions)}
        self.colors["neutral"] = NEUTRAL_COLOR

    def color_map(self) -> Dict[str, str]:
        return dict(self.colors)

    def update(self, action: str, power: float) -> Optional[Target]:
        self.last_action = action
        self.last_power = power

        color = self.colors.get(action, NEUTRAL_COLOR)
        hue, color_sat, _ = hex_to_hsv(color)

        bright_min = float(settings.get("bright_min"))
        bright_max = float(settings.get("bright_max"))

        if action == "neutral":
            # At rest: stay on the neutral colour, dimmed right down.
            bright = bright_min
        else:
            bright = bright_min + clamp(power, 0.0, 1.0) * (bright_max - bright_min)

        return Target(
            hue,
            color_sat,
            bright,
            action,
            color,
            {"power": round(power, 3), "actions": self.actions},
        )
