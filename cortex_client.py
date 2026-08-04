"""EMOTIV Cortex API client covering both app modes.

Built on the handshake state machine from
emotiv-brain-music/services/cortex_manager.py, dropping its coupling to
store/AppState/midi_server and adding trained profiles and the `com`
(Mental Commands) stream.

Nothing here returns user-facing text: events carry a *code* plus parameters,
and the UI renders them in the selected language. That is what makes English
and Chinese possible without scattering strings through the backend.
"""
import asyncio
import json
import os
import ssl
from typing import Any, Callable, Dict, List, Optional

import websockets

from config import Config
from settings import settings

# Cortex renamed "attention" to "foc"; accept both.
METRIC_ALIASES = {"attention": "foc"}

# Steps the UI draws as a status pipeline.
STEP_CREDENTIALS = "credentials"
STEP_CORTEX = "cortex"
STEP_ACCESS = "access"
STEP_HEADSET = "headset"
STEP_SESSION = "session"
STEP_PROFILE = "profile"
STEP_STREAM = "stream"


# Errors reconnecting cannot fix — only the user can. Retrying every 5s would
# just stack the same message in the log.
FATAL_CODES = {
    "err.no_credentials",
    "err.bad_credentials",
    "err.no_profile_selected",
    "err.profile_not_found",
    "err.profile_untrained",
}


class CortexError(Exception):
    """Error carrying a code the UI can translate."""

    def __init__(self, code: str, **params):
        super().__init__(code)
        self.code = code
        self.params = params


class CortexClient:
    def __init__(self, emit: Callable[[str, Dict[str, Any]], None]):
        self.emit = emit
        self.url = Config.CORTEX_URL

        self.ws = None
        self.token: Optional[str] = None
        self.session_id: Optional[str] = None
        self.headset_id: Optional[str] = None
        self.loaded_profile: Optional[str] = None

        self.met_cols: List[str] = []
        self.com_cols: List[str] = []
        self.headsets: List[Dict[str, Any]] = []
        self.profiles: List[str] = []

        self.mode = "metrics"          # "metrics" | "commands"
        self.desired_profile: str = ""
        self.client_id = ""
        self.client_secret = ""

        self._next_req_id = 1
        self._pending: Dict[int, asyncio.Future] = {}
        self._device_connected: Optional[asyncio.Future] = None
        self._running = False
        self._restart = asyncio.Event()
        self.loop: Optional[asyncio.AbstractEventLoop] = None

        # Data callbacks, wired up by the engine.
        self.on_metrics: Optional[Callable[[Dict[str, float], Dict[str, bool]], None]] = None
        self.on_command: Optional[Callable[[str, float], None]] = None

    # ---------------------------------------------------------------- helpers
    def _status(self, step: str, state: str, code: str = "", **params):
        self.emit("status", {"step": step, "state": state, "code": code, "params": params})

    def _log(self, level: str, code: str, **params):
        self.emit("log", {"level": level, "code": code, "params": params})

    # ------------------------------------------------------------------- loop
    async def run(self, client_id: str, client_secret: str):
        self.loop = asyncio.get_running_loop()
        self.client_id = client_id
        self.client_secret = client_secret
        self._running = True

        while self._running:
            try:
                await self._session_cycle()
            except CortexError as e:
                self._log("error", e.code, **e.params)
                if e.code in FATAL_CODES:
                    self.emit("fatal", {"code": e.code, "params": e.params})
                    return
            except asyncio.CancelledError:
                raise
            except Exception as e:
                self._log("error", "err.unexpected", detail=str(e))

            if not self._running:
                break

            self._clear_pending(Exception("disconnected"))
            self.ws = None
            self.session_id = None
            self.token = None
            self._status(STEP_CORTEX, "error", "status.reconnecting")
            try:
                await asyncio.wait_for(self._restart.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                pass
            self._restart.clear()

    def _reset_steps(self):
        """Clear the pipeline before each attempt.

        Without this, a reconnect leaves the UI showing 'App access: pending'
        next to 'Session: ok' — leftovers from the previous cycle that make the
        user believe in a state that no longer exists.
        """
        for step in (STEP_CORTEX, STEP_ACCESS, STEP_HEADSET, STEP_SESSION, STEP_PROFILE, STEP_STREAM):
            self._status(step, "idle")

    async def _session_cycle(self):
        self._reset_steps()

        if not self.client_id or not self.client_secret:
            self._status(STEP_CREDENTIALS, "error", "err.no_credentials")
            raise CortexError("err.no_credentials")
        self._status(STEP_CREDENTIALS, "ok")

        self._status(STEP_CORTEX, "pending", "status.connecting")
        ssl_ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        if os.path.exists(Config.CORTEX_CERT_PATH):
            ssl_ctx.load_verify_locations(cafile=Config.CORTEX_CERT_PATH)
        else:
            ssl_ctx.verify_mode = ssl.CERT_NONE
        ssl_ctx.check_hostname = False

        try:
            ws_ctx = websockets.connect(self.url, ssl=ssl_ctx, open_timeout=10)
        except Exception as e:
            raise CortexError("err.cortex_unreachable", detail=str(e))

        try:
            async with ws_ctx as ws:
                self.ws = ws
                self._status(STEP_CORTEX, "ok")

                reader = asyncio.create_task(self._read_loop(ws))
                try:
                    await self._request_access()
                    await self._authorize()
                    await self._load_profiles()
                    await self.refresh_headsets(force=False)

                    # Convenience: if the user picked a headset before and it
                    # is still listed, reconnect to it automatically. Every
                    # other case waits for a choice on screen.
                    remembered = settings.get("headset_id")
                    if remembered and any(h.get("id") == remembered for h in self.headsets):
                        await self.select_headset(remembered)
                    else:
                        self._status(STEP_HEADSET, "idle", "status.pick_headset")

                    # The reader keeps the cycle alive while the user decides.
                    await reader
                finally:
                    reader.cancel()
        except (OSError, websockets.exceptions.WebSocketException) as e:
            raise CortexError("err.cortex_unreachable", detail=str(e))

    async def _read_loop(self, ws):
        async for message in ws:
            self._handle_message(message)

    def stop(self):
        self._running = False
        if self.ws and self.loop:
            asyncio.run_coroutine_threadsafe(self.ws.close(), self.loop)

    # --------------------------------------------------------------- JSON-RPC
    async def _send(self, method: str, params: Dict[str, Any] = None, timeout: float = 30.0) -> Any:
        if not self.ws:
            raise CortexError("err.not_connected")

        req_id = self._next_req_id
        self._next_req_id += 1
        payload = {"jsonrpc": "2.0", "method": method, "params": params or {}, "id": req_id}

        future = asyncio.get_running_loop().create_future()
        self._pending[req_id] = future
        await self.ws.send(json.dumps(payload))
        try:
            return await asyncio.wait_for(future, timeout=timeout)
        except asyncio.TimeoutError:
            self._pending.pop(req_id, None)
            raise CortexError("err.timeout", method=method)

    def _clear_pending(self, error: Exception):
        for future in self._pending.values():
            if not future.done():
                future.set_exception(error)
        self._pending.clear()

    def _handle_message(self, message: str):
        try:
            data = json.loads(message)

            if "id" in data:
                future = self._pending.pop(data["id"], None)
                if future and not future.done():
                    if "error" in data:
                        err = data["error"]
                        # `api_code`, not `code`: `code` is CortexError's first
                        # positional parameter and would collide with the kwarg.
                        future.set_exception(
                            CortexError(
                                "err.cortex_api",
                                api_code=err.get("code"),
                                detail=err.get("message", ""),
                            )
                        )
                    else:
                        future.set_result(data.get("result", {}))
                return

            if "warning" in data:
                self._handle_warning(data["warning"])
                return

            if "met" in data:
                self._handle_met(data["met"])
            elif "com" in data:
                self._handle_com(data["com"])
            elif "sys" in data:
                self._log("info", "log.sys_event", detail=str(data["sys"]))

        except Exception as e:
            self._log("warn", "err.parse", detail=str(e))

    def _handle_warning(self, warning: Dict[str, Any]):
        code = warning.get("code")
        message = str(warning.get("message", ""))

        if code == 104 and self._device_connected and not self._device_connected.done():
            self._device_connected.set_result(True)
            return
        if code == 142:
            return
        if code == 11:
            # "The APIs cannot be registered. Please re-open the connection."
            # The connection went zombie: it accepts bytes but never answers.
            # Only reopening helps — insisting on it times out requestAccess.
            self._log("warn", "err.stale_connection")
            self._clear_pending(CortexError("err.stale_connection"))
            if self.ws:
                asyncio.create_task(self.ws.close())
            return
        if code == 1:  # headset disconnected
            self._status(STEP_HEADSET, "error", "err.headset_disconnected")
            self._log("warn", "err.headset_disconnected")
            return
        self._log("info", "log.cortex_warning", detail=message, warning_code=code)

    # -------------------------------------------------------------- handshake
    async def _request_access(self):
        self._status(STEP_ACCESS, "pending", "status.requesting_access")
        res = await self._send(
            "requestAccess", {"clientId": self.client_id, "clientSecret": self.client_secret}
        )
        if not res.get("accessGranted", False):
            self._status(STEP_ACCESS, "error", "err.access_pending")
            raise CortexError("err.access_pending", detail=res.get("message", ""))
        self._status(STEP_ACCESS, "ok")

    async def _authorize(self):
        try:
            res = await self._send(
                "authorize",
                {"clientId": self.client_id, "clientSecret": self.client_secret, "debit": 1},
            )
        except CortexError as e:
            self._status(STEP_ACCESS, "error", "err.bad_credentials", **e.params)
            raise CortexError("err.bad_credentials", **e.params)

        self.token = res.get("cortexToken")
        if not self.token:
            self._status(STEP_ACCESS, "error", "err.no_token")
            raise CortexError("err.no_token")

    async def refresh_headsets(self, force: bool = True):
        """List headsets. `force` also triggers the Bluetooth scan."""
        self._status(STEP_HEADSET, "pending", "status.searching_headsets")
        if force:
            await self._send("controlDevice", {"command": "refresh"})
            await asyncio.sleep(3)

        headsets = await self._send("queryHeadsets")
        self.headsets = headsets if isinstance(headsets, list) else []
        self._emit_headsets()

        if not self.headsets:
            self._status(STEP_HEADSET, "error", "err.no_headset")
        elif force:
            self._status(STEP_HEADSET, "idle", "status.pick_headset")
        return [h.get("id") for h in self.headsets]

    def _emit_headsets(self):
        self.emit("headsets", {
            "items": [
                {
                    "id": h.get("id"),
                    "status": h.get("status"),
                    "connectedBy": h.get("connectedBy"),
                    "virtual": bool(h.get("virtualHeadsetId")),
                }
                for h in self.headsets
            ],
            "selected": self.headset_id or "",
        })

    async def select_headset(self, headset_id: str):
        """Connect the headset the user picked and open the session."""
        target = next((h for h in self.headsets if h.get("id") == headset_id), None)
        if not target:
            self._status(STEP_HEADSET, "error", "err.headset_not_found", headset=headset_id)
            raise CortexError("err.headset_not_found", headset=headset_id)

        self._status(STEP_HEADSET, "pending", "status.connecting_headset", headset=headset_id)
        self.headset_id = headset_id
        settings.set("headset_id", headset_id)
        settings.save()

        if target.get("status") != "connected":
            self._device_connected = asyncio.get_running_loop().create_future()
            await self._send("controlDevice", {"command": "connect", "headset": headset_id})
            try:
                await asyncio.wait_for(self._device_connected, timeout=30.0)
            except asyncio.TimeoutError:
                self._log("warn", "err.headset_connect_timeout", headset=headset_id)
            finally:
                self._device_connected = None

        self._status(STEP_HEADSET, "ok", "status.headset_ready", headset=headset_id)
        self._emit_headsets()

        await self._create_or_reuse_session()
        await self._after_session()

    async def _after_session(self):
        """After the session: metrics can run already; BCI needs a profile first."""
        if self.mode == "metrics":
            self._status(STEP_PROFILE, "idle")
            await self._subscribe(["met"])
            return

        remembered = self.desired_profile or settings.get("profile")
        if remembered and remembered in self.profiles:
            try:
                await self.select_profile(remembered)
            except CortexError:
                # The "Profile" step already shows the exact reason. Letting
                # the exception bubble would only stack a generic "could not
                # switch mode" on top, burying the real cause.
                pass
        else:
            self._status(STEP_PROFILE, "idle", "status.pick_profile")

    async def _create_or_reuse_session(self):
        self._status(STEP_SESSION, "pending")
        sessions = await self._send("querySessions", {"cortexToken": self.token})
        mine = (
            [s for s in sessions if s.get("headsetId") == self.headset_id]
            if isinstance(sessions, list)
            else []
        )

        active = next((s for s in mine if s.get("status") in ("active", "opened")), None)
        if active:
            self.session_id = active["id"]
            self._status(STEP_SESSION, "ok", "status.session_reused")
            return

        for s in mine:
            try:
                await self._send(
                    "updateSession",
                    {"cortexToken": self.token, "session": s["id"], "status": "close"},
                )
            except Exception:
                pass

        try:
            res = await self._send(
                "createSession",
                {"cortexToken": self.token, "headset": self.headset_id, "status": "active"},
            )
            self.session_id = res.get("id")
        except CortexError as e:
            # Defensive recovery from -32005 ("session already exists").
            if str(e.params.get("api_code")) == "-32005" or "exist" in str(e.params.get("detail", "")).lower():
                sessions = await self._send("querySessions", {"cortexToken": self.token})
                mine = [s for s in sessions if s.get("headsetId") == self.headset_id]
                if mine:
                    self.session_id = mine[0]["id"]
                    self._status(STEP_SESSION, "ok", "status.session_recovered")
                    return
            self._status(STEP_SESSION, "error", e.code, **e.params)
            raise

        self._status(STEP_SESSION, "ok", "status.session_created")

    # -------------------------------------------------------------- profiles
    async def _load_profiles(self):
        try:
            res = await self._send("queryProfile", {"cortexToken": self.token})
            self.profiles = [p.get("name") for p in res if p.get("name")] if isinstance(res, list) else []
        except CortexError as e:
            self.profiles = []
            self._log("warn", "err.profiles_failed", **e.params)
        self.emit("profiles", {"items": self.profiles})

    async def select_profile(self, name: str):
        """Load the chosen profile and read the action order — that order is
        what determines each slot colour, exactly like EmotivBCI does."""
        if not name:
            self._status(STEP_PROFILE, "error", "err.no_profile_selected")
            raise CortexError("err.no_profile_selected")
        if name not in self.profiles:
            self._status(STEP_PROFILE, "error", "err.profile_not_found", profile=name)
            raise CortexError("err.profile_not_found", profile=name)
        if not self.headset_id or not self.session_id:
            self._status(STEP_PROFILE, "error", "err.no_headset_selected")
            raise CortexError("err.no_headset_selected")

        self._status(STEP_PROFILE, "pending", "status.loading_profile", profile=name)
        self.desired_profile = name
        settings.set("profile", name)
        settings.save()

        # Cortex refuses to load a profile while another one sits on the
        # headset ("A profile is already loaded for this headset"). Without
        # this, switching profiles would only work once per session.
        await self._unload_current_profile()

        try:
            await self._load_profile_once(name)
        except CortexError as e:
            # -32127: "a profile is already loaded". Happens when another app
            # or session loaded it — getCurrentProfile then returns name=None
            # and the pre-emptive unload finds nothing to drop. Unload by target
            # name and retry once.
            if str(e.params.get("api_code")) == "-32127":
                await self._force_unload(name)
                try:
                    await self._load_profile_once(name)
                except CortexError as retry_error:
                    self._fail_profile(name, retry_error)
            else:
                self._fail_profile(name, e)

        self.loaded_profile = name

        actions = await self._active_actions(name)
        if not actions or actions == ["neutral"]:
            # The profile exists but has no trained action beyond neutral: the
            # bulb would just sit there, so say so instead of pretending.
            self._status(STEP_PROFILE, "error", "err.profile_untrained", profile=name)
            raise CortexError("err.profile_untrained", profile=name)

        self.emit("actions", {"items": actions, "profile": name})
        self._status(STEP_PROFILE, "ok", "status.profile_loaded", profile=name)

        await self._subscribe(["com"])
        return actions

    def _fail_profile(self, name: str, error: CortexError):
        """Turn a load failure into a coded error and stop."""
        # -32226: profile trained on a different headset model. It deserves its
        # own message, because the way out is another profile, not a retry.
        if str(error.params.get("api_code")) == "-32226":
            self._status(STEP_PROFILE, "error", "err.profile_incompatible",
                         profile=name, headset=self.headset_id)
            raise CortexError("err.profile_incompatible",
                              profile=name, headset=self.headset_id)
        self._status(STEP_PROFILE, "error", "err.profile_load_failed", profile=name,
                     detail=error.params.get("detail", ""))
        raise error

    async def _load_profile_once(self, name: str):
        await self._send(
            "setupProfile",
            {
                "cortexToken": self.token,
                "headset": self.headset_id,
                "profile": name,
                "status": "load",
            },
            timeout=45.0,
        )

    async def _force_unload(self, name: str):
        """Unload by name, ignoring the error when nothing was loaded."""
        try:
            await self._send(
                "setupProfile",
                {
                    "cortexToken": self.token,
                    "headset": self.headset_id,
                    "profile": name,
                    "status": "unload",
                },
                timeout=30.0,
            )
        except CortexError:
            pass

    async def _unload_current_profile(self):
        """Unload whatever sits on the headset, no matter which app loaded it."""
        try:
            current = await self._send(
                "getCurrentProfile", {"cortexToken": self.token, "headset": self.headset_id}
            )
        except CortexError:
            return

        name = (current or {}).get("name")
        if not name:
            return

        try:
            await self._send(
                "setupProfile",
                {
                    "cortexToken": self.token,
                    "headset": self.headset_id,
                    "profile": name,
                    "status": "unload",
                },
                timeout=30.0,
            )
            self.loaded_profile = None
        except CortexError as e:
            self._log("warn", "err.profile_unload_failed", profile=name,
                      detail=e.params.get("detail", ""))

    async def _active_actions(self, profile: str) -> List[str]:
        """Trained action order — this is what defines each slot colour."""
        try:
            res = await self._send(
                "mentalCommandActiveAction",
                {"cortexToken": self.token, "status": "get", "profile": profile},
            )
            if isinstance(res, list):
                return [a for a in res if isinstance(a, str)]
        except CortexError as e:
            self._log("warn", "err.actions_failed", **e.params)
        return []

    # ------------------------------------------------------------------ mode
    async def _subscribe(self, streams: List[str]):
        self._status(STEP_STREAM, "pending")
        res = await self._send(
            "subscribe",
            {"cortexToken": self.token, "session": self.session_id, "streams": streams},
        )

        for ok in res.get("success", []):
            if ok.get("streamName") == "met":
                self.met_cols = ok.get("cols", [])
            elif ok.get("streamName") == "com":
                self.com_cols = ok.get("cols", [])

        failures = res.get("failure", [])
        if failures:
            fail = failures[0]
            self._status(STEP_STREAM, "error", "err.subscribe_failed",
                         stream=fail.get("streamName"), detail=fail.get("message", ""))
            raise CortexError("err.subscribe_failed",
                              stream=fail.get("streamName"), detail=fail.get("message", ""))

        self._status(STEP_STREAM, "ok", "status.streaming", mode=self.mode)

    async def _unsubscribe_all(self):
        streams = [s for s in (["met"] if self.met_cols else []) + (["com"] if self.com_cols else [])]
        if not streams or not self.session_id:
            return
        try:
            await self._send(
                "unsubscribe",
                {"cortexToken": self.token, "session": self.session_id, "streams": streams},
            )
        except Exception:
            pass
        self.met_cols = []
        self.com_cols = []

    async def switch_mode(self, mode: str, profile: str = ""):
        """Switch mode without tearing down the session."""
        self.mode = mode
        if profile:
            self.desired_profile = profile
        if not self.ws or not self.session_id:
            # Not connected yet: the new mode applies once the link comes up.
            return
        await self._unsubscribe_all()
        await self._after_session()

    # ------------------------------------------------------------------ data
    def _handle_met(self, raw: List[Any]):
        if not self.met_cols or not raw:
            return

        values: Dict[str, float] = {}
        active: Dict[str, bool] = {}

        for col, val in zip(self.met_cols, raw):
            if col.endswith(".isActive"):
                base = col[: -len(".isActive")]
                active[METRIC_ALIASES.get(base, base)] = bool(val)
            else:
                name = METRIC_ALIASES.get(col, col)
                if isinstance(val, (int, float)):
                    values[name] = float(val)
                else:
                    active.setdefault(name, False)

        if self.on_metrics:
            self.on_metrics(values, active)

    def _handle_com(self, raw: List[Any]):
        """`com` arrives as [action, power]."""
        if not raw:
            return
        action = str(raw[0]) if len(raw) > 0 else "neutral"
        try:
            power = float(raw[1]) if len(raw) > 1 else 0.0
        except (TypeError, ValueError):
            power = 0.0
        if self.on_command:
            self.on_command(action, power)
