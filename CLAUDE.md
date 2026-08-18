# Working on this repo

EMOTIV Cortex driving a smart light. Read `README.md` for what it does; this
file is for what the code cannot tell you — the things that cost hours to find.

## Running and testing

```bash
.venv/bin/python app.py                  # the app
.venv/bin/python main.py --demo          # light only, synthetic metrics, no headset
```

Hardware is often unavailable. Both brands have fake devices that speak the real
protocol back, and they catch most wiring mistakes — see the commit history for
`fake_lifx` / `fake_yeelight` patterns. **Prefer proving a thing over asserting
it**: this codebase's worst bugs all looked correct when read.

## Traps that already bit

**Never emit UI events from the shutdown path.** pywebview runs `closing`
synchronously on the UI thread, and cocoa's `evaluate_js` schedules work on that
same thread then blocks for the result. Emitting during teardown deadlocks the
app into a Force Quit. `Api.closing` guards this.

**`_status(x=..., **e.params)` explodes when `params` already holds `x`.** This
has landed twice — once as `code`/`api_code`, once as `ip`. The symptom is a
`TypeError` replacing what should have been a readable error message. Merge with
`**{"x": x, **e.params}` instead.

**Discovery must walk every interface.** Both brands broadcast/multicast, and
leaving the interface to the OS silently finds nothing whenever the default
route is not the light's LAN. `lights/net.py` exists for this.

**Never bake a default IP into `Config.BULB_IP`.** A fresh install with a
hardcoded address chases a light on someone else's network instead of prompting.

**The browser caches `i18n.js` hard.** When testing translation changes in the
Browser pane, `reload()` is not enough — compare what the HTTP server actually
serves against the file on disk, or use a cache-busting query.

## Cortex quirks

| Code | Meaning | Handling |
|---|---|---|
| warning 11 | The service is wedged | Reopen the socket. If it persists it is the daemon, not us: `sudo launchctl kickstart -k system/com.emotiv.cortex`. Restarting EMOTIV Launcher does **not** help — CortexService is a separate root daemon that can stay up for weeks. |
| -32005 | Session already exists | Close stale sessions and retry; a single re-query can come back empty. |
| -32127 | A profile is already loaded | Unload first. `getCurrentProfile` returns `name: null` when another app loaded it, so also unload by target name and retry once. |
| -32226 | Profile trained on another headset model | Not retryable. Tell the user to pick another profile. |
| -32007 | Session does not exist | `mentalCommandActionSensitivity` with `status: set` needs a **session**, not a profile name, despite what the docs imply. |

**The metric is `attention`, not `foc`.** Verified against the live `met` schema
on Cortex 4.8. `foc` is folded onto it as an alias, not the other way round.

**Sensitivity values skip `neutral`.** The array is always four long and lines
up with the active actions minus neutral — same ordering as the slot colours.

## Conventions

**The backend never emits user-facing text.** It sends a translation code plus
parameters; `ui/i18n.js` turns that into a sentence. After touching strings,
check EN/ZH key parity — both blocks must have identical key sets, and every
`data-i18n` in the HTML must exist in both.

**Brand-specific code lives only in `lights/`.** The engine, mapping and UI are
brand-agnostic. Transports raise `LightError` with a translation code so the
engine never has to recognise a vendor's error string.

**`PERFORMANCE_METRIC_KEYS` in `palette.py` is the single gate** for which
metrics are shown *and* allowed to pick a colour. Removing a metric from the
display only would let it keep winning the colour while invisible.

**Colours are extracted from EMOTIV's own binaries**, not chosen. Do not
"improve" them.

## Still unverified

- The LIFX driver has never driven real hardware.
- The Windows build has never been run — only built and inspected.
