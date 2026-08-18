"""Orchestrates Cortex + mapping + bulb, and publishes events to the UI.

Runs the asyncio loop on a daemon thread. The UI (pywebview's main thread)
talks to the engine through synchronous methods that schedule work on it.
"""
import asyncio
import threading
import time
from typing import Any, Callable, Dict, Optional

from bulb_driver import SmoothBulb, find_bulb_ip
from lights import DEFAULT_BRAND, LightError
from config import Config
from cortex_client import CortexClient
from mapping import MentalCommandMapper, PerformanceMetricsMapper
from palette import PERFORMANCE_METRIC_COLORS, PERFORMANCE_METRIC_KEYS
from settings import settings

STEP_BULB = "bulb"


class Engine:
    def __init__(self, emit: Callable[[str, Dict[str, Any]], None]):
        self._emit_raw = emit
        self.cortex = CortexClient(self.emit)
        self.cortex.on_metrics = self._on_metrics
        self.cortex.on_command = self._on_command

        self.bulb: Optional[SmoothBulb] = None
        self.metrics_mapper = PerformanceMetricsMapper(Config)
        self.command_mapper = MentalCommandMapper(Config)

        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None
        self._cortex_task: Optional[asyncio.Task] = None
        self.running = False

        self._last_push = 0.0
        self._last_target: Dict[str, Any] = {}

    # ----------------------------------------------------------- infrastructure
    def emit(self, event: str, data: Dict[str, Any]):
        # Trained actions arrive from Cortex as an event; this is where they
        # become slot colours, before the UI hears about them.
        if event == "actions":
            self.command_mapper.set_actions(data.get("items", []))
            data = dict(data, colors=self.command_mapper.color_map(),
                        order=self.command_mapper.actions)
        elif event == "fatal":
            # An error only the user can fix: shut down instead of looping on
            # reconnects. On another thread, because stop() cancels the task
            # that called us.
            threading.Thread(target=self.stop, daemon=True).start()
            return
        try:
            self._emit_raw(event, data)
        except Exception as e:
            print(f"[engine] failed to emit {event}: {e}")

    def _status(self, step: str, state: str, code: str = "", **params):
        self.emit("status", {"step": step, "state": state, "code": code, "params": params})

    def _log(self, level: str, code: str, **params):
        self.emit("log", {"level": level, "code": code, "params": params})

    def start_loop(self):
        if self._thread:
            return
        ready = threading.Event()

        def runner():
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)
            ready.set()
            self.loop.run_forever()

        self._thread = threading.Thread(target=runner, name="engine-loop", daemon=True)
        self._thread.start()
        ready.wait(5.0)

    def _submit(self, coro):
        if not self.loop:
            raise RuntimeError("engine loop is not running")
        return asyncio.run_coroutine_threadsafe(coro, self.loop)

    # -------------------------------------------------------------------- bulb
    def discover_bulb(self) -> Optional[str]:
        self._status(STEP_BULB, "pending", "status.discovering_bulb")
        try:
            ip = find_bulb_ip()
        except Exception as e:
            self._status(STEP_BULB, "error", "err.discover_failed", detail=str(e))
            return None
        if not ip:
            self._status(STEP_BULB, "error", "err.no_bulb_found")
            return None
        self._status(STEP_BULB, "idle", "status.bulb_found", ip=ip)
        return ip

    def _connect_bulb(self) -> bool:
        ip = settings.get("bulb_ip") or Config.BULB_IP
        if not ip:
            self._status(STEP_BULB, "error", "err.no_bulb_ip")
            return False

        brand = settings.get("light_brand") or DEFAULT_BRAND
        self._status(STEP_BULB, "pending", "status.connecting_bulb", ip=ip)
        bulb = SmoothBulb(ip, brand=brand)
        try:
            bulb.connect(attempts=3)
        except LightError as e:
            # The transport already chose a translatable code, so the engine
            # never has to recognise a vendor's error string. Merge rather than
            # pass ip= alongside **e.params: the transport already puts ip in
            # there, and the duplicate raises TypeError instead of reporting the
            # failure.
            self._status(STEP_BULB, "error", e.code, **{"ip": ip, **e.params})
            return False
        except Exception as e:
            self._status(STEP_BULB, "error", "err.bulb_unreachable", ip=ip, detail=str(e))
            return False

        bulb.start()
        self.bulb = bulb
        self._status(STEP_BULB, "ok", "status.bulb_ready", ip=ip)
        return True

    def _disconnect_bulb(self):
        if self.bulb:
            try:
                self.bulb.stop()
            except Exception:
                pass
            self.bulb = None
        self._status(STEP_BULB, "idle")

    # ------------------------------------------------------------- lifecycle
    def start(self) -> Dict[str, Any]:
        if self.running:
            return {"ok": True}

        client_id = settings.get("client_id", "").strip()
        client_secret = settings.get("client_secret", "").strip()
        if not client_id or not client_secret:
            self._status("credentials", "error", "err.no_credentials")
            return {"ok": False, "code": "err.no_credentials"}

        self.start_loop()

        if not self._connect_bulb():
            return {"ok": False, "code": "err.bulb_unreachable"}

        self.metrics_mapper.reset()
        self.cortex.mode = settings.get("mode", "metrics")
        self.cortex.desired_profile = settings.get("profile", "")

        self.running = True
        self._cortex_task = self._submit(self.cortex.run(client_id, client_secret))
        self.emit("running", {"running": True})
        return {"ok": True}

    def stop(self) -> Dict[str, Any]:
        self.running = False
        try:
            self.cortex.stop()
        except Exception:
            pass
        if self._cortex_task:
            self._cortex_task.cancel()
            self._cortex_task = None
        self._disconnect_bulb()
        for step in ("cortex", "access", "headset", "session", "profile", "stream"):
            self._status(step, "idle")
        self.emit("running", {"running": False})
        return {"ok": True}

    # ------------------------------------------------------- user selections
    def _run_step(self, coro, fail_code: str, timeout: float = 90.0) -> Dict[str, Any]:
        """Run a user action on the engine loop and return the result.

        Errors already became status/log entries inside; this only keeps the
        exception from vanishing and leaving a button spinning forever.
        """
        if not self.running or not self.loop:
            return {"ok": False, "code": "err.not_running"}
        try:
            return {"ok": True, "result": self._submit(coro).result(timeout=timeout)}
        except Exception as e:
            code = getattr(e, "code", None) or fail_code
            params = getattr(e, "params", None) or {"detail": str(e)}
            return {"ok": False, "code": code, "params": params}

    def refresh_headsets(self) -> Dict[str, Any]:
        return self._run_step(self.cortex.refresh_headsets(force=True), "err.no_headset")

    def select_headset(self, headset_id: str) -> Dict[str, Any]:
        return self._run_step(self.cortex.select_headset(headset_id), "err.headset_not_found")

    def select_profile(self, name: str) -> Dict[str, Any]:
        return self._run_step(self.cortex.select_profile(name), "err.profile_load_failed")

    def set_sensitivity(self, values) -> Dict[str, Any]:
        return self._run_step(self.cortex.set_sensitivity(list(values)),
                              "err.sensitivity_failed", timeout=30.0)

    def set_mode(self, mode: str, profile: str = "") -> Dict[str, Any]:
        settings.set("mode", mode)
        if profile:
            settings.set("profile", profile)
        settings.save()

        if mode == "metrics":
            self.metrics_mapper.reset()

        if not self.running:
            self.emit("mode", {"mode": mode, "profile": profile})
            return {"ok": True}

        future = self._submit(self.cortex.switch_mode(mode, profile or settings.get("profile", "")))
        try:
            future.result(timeout=60)
        except Exception as e:
            self._log("error", "err.mode_switch_failed", detail=str(e))
            return {"ok": False, "code": "err.mode_switch_failed", "detail": str(e)}

        self.emit("mode", {"mode": mode, "profile": profile})
        return {"ok": True}

    # --------------------------------------------------------------- EEG data
    def _apply_target(self, target):
        if not target:
            return
        if self.bulb:
            self.bulb.set_target(target.hue, target.sat, target.bright)

        # The UI does not need JSON at 2 Hz; 10/s already outruns the eye.
        now = time.monotonic()
        self._last_target = target.as_dict()
        if now - self._last_push >= 0.1:
            self._last_push = now
            self.emit("target", self._last_target)

    def _on_metrics(self, values, active):
        self._apply_target(self.metrics_mapper.update(values, active))

    def _on_command(self, action, power):
        self._apply_target(self.command_mapper.update(action, power))

    @staticmethod
    def metric_palette() -> Dict[str, str]:
        return {k: PERFORMANCE_METRIC_COLORS[k] for k in PERFORMANCE_METRIC_KEYS}
