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

A **virtual headset** from EMOTIV Launcher streams real-shaped data through the
real Cortex, which is enough to drive a whole training cycle end to end. Do it
on a throwaway profile and delete it afterwards. The frontend has no such luxury
— stub `window.pywebview.api` and call `window.pushEvent` with the exact event
shapes the engine emits, and the entire interface can be exercised in a browser
with no headset and no light.

## Traps that already bit

**Nothing public on `Api` except the methods the page calls.** pywebview
exposes the js_api object by recursing into every attribute not starting with
`_`. Public `window` and `engine` attributes sent it crawling through the
pywebview Window and the asyncio loop, and on Windows with pywebview 6.2.1 the
window never became responsive — `Responding=False` from the first second,
py-spy showing the `generate_js_object` thread deep in `get_functions`.
v1.0.0 shipped with this. CI did not catch it: the launch check only proves the
process stays up, and a frozen window stays up too. Open release builds by hand.

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
| -32602 on `setupProfile status=create` | Invalid Parameters | `create` requires `headset`, whatever the docs say. `delete` does not want it. |
| -32602 on `training status=reset` | "This parameter is required: action" | There is no whole-signature reset — `reset` is per action. Emptying a profile means erasing each trained action in turn. |

## Mental Command training

The whole cycle, confirmed against Cortex 4.8 and against EmotivBCI's own logs
(`~/Library/Application Support/Emotiv/EmotivBCI/logs/`, which record every
method it calls):

```
training status=start  -> sys MC_Started -> 8s of EEG -> sys MC_Succeeded|MC_Failed
training status=accept -> sys MC_Completed -> setupProfile status=save
training status=reject -> sys MC_Rejected, nothing changes
training status=erase  -> sys MC_DataErased -> sys MC_SignatureUpdated
```

**Nothing is read back until `MC_Completed`.** Cortex rebuilds the signature
*after* the accept call returns, so `getTrainedSignatureActions` and
`mentalCommandBrainMap` queried straight after accept report the state from
before the recording — permanently one step behind. `_after_accept` hangs off
the event instead. `MC_SignatureUpdated` fires on erase but **not** on accept,
so it cannot be the only trigger.

**A new profile inherits whatever is loaded.** `setupProfile status=create`
builds the profile from the detection state on the headset, so creating one
while another profile sits there hands the "empty" profile that profile's
training. `create_profile` unloads first; verified that it then comes back with
active `["neutral"]` and no trained actions.

**Prefer the session over the profile name.** `getTrainedSignatureActions`,
`mentalCommandBrainMap`, `mentalCommandTrainingThreshold`,
`mentalCommandGetSkillRating` and `mentalCommandActiveAction` all accept
either. Once a training completes they agree, but only the session is
guaranteed to be the state Cortex is actually running. `_scope()` picks.

**`mentalCommandActiveAction status=set` excludes neutral.** A `get` puts it
back at the front. Removing the only trained command sets `actions: []` and the
next `get` returns `["neutral"]`.

**The quality streams grade differently.** `dev` cols nest the sensor names
inside the header — `["Battery","Signal",["AF3",…,"OVERALL"],"BatteryPercent"]`
— and its `OVERALL` entry is a *percentage* sitting among 0-4 per-sensor
grades. `eq` is flat, and its `overall` is already a percentage while its
per-sensor entries use the same 0-4 scale. Sample from an Insight 2:
`dev [3, 1.0, [4,4,4,4,4,100], 80]`, `eq [80, 92, 1.0, 4,4,4,4,3]`.

**`loop.create_task` from another thread silently does nothing.** It only
schedules when the caller is already on the loop thread, and the failure is
mute — the training animation froze on its first frame. Use `Engine._submit`,
which works from either side.

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

**An untrained profile is not an error.** It used to be fatal, which made the
one state a freshly created profile is in a dead end. It now loads, says what is
missing, and hands the user to the training panel.

## Still unverified

- The Windows build has been run from source (window responsive after the
  `Api` fix), but the packaged installer has not been opened by hand.
- Training has only been exercised on a **virtual** headset. The API cycle is
  proven; whether a signature trained on real EEG through this UI performs as
  well as one trained in EmotivBCI is not.
