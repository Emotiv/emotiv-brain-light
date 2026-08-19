"""User settings, persisted to disk.

Kept separate from config.py: that one holds developer defaults (environment
variables), this one holds what the user types into the UI and has to survive
closing the app — with the installer in mind, where no .env exists.
"""
import json
import os
import threading
from typing import Any, Dict

APP_DIR = os.path.expanduser("~/.emotiv_brain_light")
SETTINGS_PATH = os.path.join(APP_DIR, "settings.json")

DEFAULTS: Dict[str, Any] = {
    "language": None,        # None = not chosen yet, triggers the language screen
    "light_brand": None,     # None = not chosen yet, triggers the brand screen
    "client_id": "",
    "client_secret": "",
    "bulb_ip": "",
    "headset_id": "",
    "mode": "metrics",       # "metrics" | "commands"
    "profile": "",           # trained profile, used in commands mode
    "score_mode": "adaptive",
    # Whether the light animates the training window. Off leaves it on the
    # live colour while a recording runs.
    "training_light_feedback": True,
    "smooth_tau": 0.45,
    "bright_min": 12.0,
    "bright_max": 100.0,
    "sat_min": 55.0,
    "sat_max": 100.0,
}


class Settings:
    """Thread-safe persistent dictionary."""

    def __init__(self, path: str = SETTINGS_PATH):
        self.path = path
        self._lock = threading.Lock()
        self._data = dict(DEFAULTS)
        self.load()

    def load(self):
        if not os.path.exists(self.path):
            return
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                stored = json.load(f)
            with self._lock:
                for key, value in stored.items():
                    if key in DEFAULTS:
                        self._data[key] = value
        except Exception as e:
            print(f"[settings] could not read {self.path}: {e}; using defaults")

    def save(self):
        try:
            os.makedirs(APP_DIR, exist_ok=True)
            with self._lock:
                snapshot = dict(self._data)
            tmp = self.path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(snapshot, f, indent=2, ensure_ascii=False)
            os.replace(tmp, self.path)
            # Credentials live in here; do not leave it readable to other users.
            os.chmod(self.path, 0o600)
            return True
        except Exception as e:
            print(f"[settings] failed to save: {e}")
            return False

    def get(self, key: str, default=None):
        with self._lock:
            return self._data.get(key, DEFAULTS.get(key, default))

    def set(self, key: str, value):
        with self._lock:
            self._data[key] = value

    def update(self, values: Dict[str, Any]):
        with self._lock:
            for key, value in values.items():
                if key in DEFAULTS:
                    self._data[key] = value

    def as_dict(self) -> Dict[str, Any]:
        with self._lock:
            return dict(self._data)

    def public_dict(self) -> Dict[str, Any]:
        """Same as as_dict, but never hands the secret back to the UI in clear."""
        data = self.as_dict()
        data["client_secret_set"] = bool(data.get("client_secret"))
        data["client_secret"] = ""
        return data


settings = Settings()
