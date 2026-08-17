"""UI entry point (pywebview).

The window is a local WebView; Python exposes an API to JS and pushes events
back with evaluate_js. Designed to become an installer build: nothing here
depends on .env, and everything the user configures lives in
~/.emotiv_brain_light.
"""
import json
import os
import sys
import threading
from typing import Any, Dict

import webview

from engine import Engine
from settings import settings

UI_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui")


def resource_dir() -> str:
    """Works both from source and inside a PyInstaller bundle."""
    if getattr(sys, "frozen", False):
        return os.path.join(sys._MEIPASS, "ui")
    return UI_DIR


class Api:
    def __init__(self):
        self.window = None
        self.engine = Engine(self.push_event)
        self._lock = threading.Lock()

    # --------------------------------------------------------------- to the JS
    def push_event(self, event: str, data: Dict[str, Any]):
        if not self.window:
            return
        payload = json.dumps({"event": event, "data": data}, ensure_ascii=False)
        try:
            # The JSON goes in as a literal so quote escaping cannot bite us.
            self.window.evaluate_js(
                f"(function(){{var m={payload};window.pushEvent(m.event,m.data);}})()"
            )
        except Exception:
            # Window closing mid-event is no reason to take the engine down.
            pass

    # ------------------------------------------------------------- JS-facing API
    def get_state(self):
        return {
            "settings": settings.public_dict(),
            "metric_palette": Engine.metric_palette(),
            "profiles": self.engine.cortex.profiles,
            "running": self.engine.running,
        }

    def save_settings(self, values: Dict[str, Any]):
        with self._lock:
            settings.update(values or {})
            settings.save()
        return settings.public_dict()

    def start(self):
        return self.engine.start()

    def stop(self):
        return self.engine.stop()

    def set_mode(self, mode: str, profile: str = ""):
        return self.engine.set_mode(mode, profile or "")

    def refresh_headsets(self):
        return self.engine.refresh_headsets()

    def select_headset(self, headset_id: str):
        return self.engine.select_headset(headset_id)

    def select_profile(self, name: str):
        return self.engine.select_profile(name)

    def discover_bulb(self):
        ip = self.engine.discover_bulb()
        if ip:
            settings.set("bulb_ip", ip)
            settings.save()
        return ip


def main():
    api = Api()
    window = webview.create_window(
        "EMOTIV Brain Light",
        os.path.join(resource_dir(), "index.html"),
        js_api=api,
        width=1160,
        height=780,
        min_size=(880, 620),
        background_color="#0c0e12",
    )
    api.window = window

    def on_closing():
        # Without this the bulb keeps believing it is still in music mode.
        try:
            api.engine.stop()
        except Exception:
            pass

    def on_loaded():
        # Surface a frontend bootstrap failure on stderr too, so a packaged build
        # can be diagnosed from the console instead of a blank window.
        try:
            error = window.evaluate_js("window.__bootError || ''")
            if error:
                print(f"[ui] bootstrap error: {error}", file=sys.stderr)
        except Exception:
            pass

    window.events.loaded += on_loaded
    window.events.closing += on_closing
    # http_server=True serves ui/ from 127.0.0.1 instead of handing WebKit a
    # file:// URL. In a packaged .app the file:// load fails silently (the page
    # never fires `loaded` and the window stays blank), and the bundle path
    # contains spaces, which makes it worse. The server binds to localhost only.
    webview.start(http_server=True)


if __name__ == "__main__":
    main()
