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
    """Everything public on this object is callable from JavaScript.

    pywebview builds the page's API by walking dir() of this object and
    recursing into every attribute whose name does not start with an
    underscore. With `window` and `engine` public it crawled the whole pywebview
    Window, the asyncio loop and the Cortex client before letting the page
    start, and the window never became responsive — measured on Windows with
    pywebview 6.2.1, Responding=False from the first second. So all state is
    underscored, and the only public names are the methods the page calls.
    """

    def __init__(self):
        self._window = None
        self._engine = Engine(self._push_event)
        self._lock = threading.Lock()
        # Set once the window starts closing. See _push_event for why.
        self._closing = False

    # --------------------------------------------------------------- to the JS
    def _push_event(self, event: str, data: Dict[str, Any]):
        if not self._window or self._closing:
            # Never touch the webview while it is going away. pywebview runs the
            # `closing` handler synchronously on the UI thread, and evaluate_js
            # schedules work on that same thread and then blocks waiting for it.
            # Emitting from the shutdown path deadlocks the app, which then only
            # dies to a Force Quit.
            return
        payload = json.dumps({"event": event, "data": data}, ensure_ascii=False)
        try:
            # The JSON goes in as a literal so quote escaping cannot bite us.
            self._window.evaluate_js(
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
            "profiles": self._engine.cortex.profiles,
            "running": self._engine.running,
        }

    def save_settings(self, values: Dict[str, Any]):
        with self._lock:
            settings.update(values or {})
            settings.save()
        return settings.public_dict()

    def start(self):
        return self._engine.start()

    def stop(self):
        return self._engine.stop()

    def set_mode(self, mode: str, profile: str = ""):
        return self._engine.set_mode(mode, profile or "")

    def refresh_headsets(self):
        return self._engine.refresh_headsets()

    def select_headset(self, headset_id: str):
        return self._engine.select_headset(headset_id)

    def select_profile(self, name: str):
        return self._engine.select_profile(name)

    def set_sensitivity(self, values):
        return self._engine.set_sensitivity(values)

    # --------------------------------------------------------------- training
    def create_profile(self, name: str):
        return self._engine.create_profile(name)

    def refresh_commands(self):
        return self._engine.refresh_commands()

    def set_active_actions(self, actions):
        return self._engine.set_active_actions(actions or [])

    def start_training(self, action: str):
        return self._engine.start_training(action)

    def accept_training(self):
        return self._engine.accept_training()

    def reject_training(self):
        return self._engine.reject_training()

    def erase_training(self, action: str):
        return self._engine.erase_training(action)

    def reset_training(self):
        return self._engine.reset_training()

    def training_result(self):
        return self._engine.training_result()

    def discover_bulb(self):
        ip = self._engine.discover_bulb()
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
    api._window = window

    def on_closing():
        # Order matters: silence the bridge first, then tear down. The teardown
        # emits status events, and any of them would deadlock the UI thread.
        api._closing = True
        try:
            # Without this the light keeps believing it is still in music mode.
            api._engine.stop()
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
