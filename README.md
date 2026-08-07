# emotiv-brain-light

EMOTIV Cortex driving a **Yeelight YLDP06YL** (Color Bulb E27, 2019) in real
time, with a desktop UI in English and Chinese.

Two modes:

- **Performance Metrics** — the strongest metric right now picks the colour, its
  intensity sets the brightness, and its lead over the runner-up sets the
  saturation.
- **Mental Commands (BCI)** — the action detected by a trained profile picks the
  colour, and the detection strength sets the brightness.

```bash
.venv/bin/python app.py
```

## Colours

**These are not invented colours.** They were extracted from the EMOTIV apps so
that what the bulb shows matches what the user already sees in EmotivPRO and
EmotivBCI.

### Performance Metrics

From the `performanceMetrics` table inside the EmotivPRO binary:

| Metric | Cortex key | Colour |
|---|---|---|
| Engagement | `eng` | `#2ec6c8` |
| Excitement | `exc` | `#e9cc40` |
| Stress | `str` | `#a781f3` |
| Relaxation | `rel` | `#5ab0ee` |
| Interest | `int` | `#f2974e` |
| Focus | `foc` | `#50e17d` |

### Mental Commands

EmotivBCI does **not** assign a fixed colour per action name: it assigns one per
*slot*, in the order the actions appear in the trained profile. Confirmed in the
app's own logs (`~/Library/Application Support/Emotiv/EmotivBCI/logs/`), which
record `cmd: Push color: #2ec6c8` and `cmd: Neutral color: #ff0066`.

This app does the same: it reads the order via `mentalCommandActiveAction` and
hands out `#2ec6c8`, `#f2974e`, `#a781f3`, `#5ab0ee`, … across the slots.
`neutral` is always `#ff0066` and consumes no slot.

Profiles with more than four trained actions continue through the rest of the
EmotivPRO chart palette — that part is our choice, since the official app does
not go that far.

## Architecture

```
app.py            pywebview window + the API exposed to JS
 └─ engine.py     orchestrates Cortex + mapping + bulb, publishes events
     ├─ cortex_client.py   Cortex WebSocket: handshake, profiles, met, com
     ├─ mapping.py         data -> HSV target (one mapper per mode)
     ├─ palette.py         official palettes + colour conversions
     └─ bulb_driver.py     music mode + interpolation at 25 fps
ui/               index.html, app.css, app.js, i18n.js
settings.py       what the user configures, in ~/.emotiv_brain_light
config.py         developer defaults (env vars / .env)
main.py           command-line mode, for testing without the UI
```

The Cortex connection layer comes from `emotiv-brain-music`
(`services/cortex_manager.py`) — same handshake state machine, same session
reuse, same `-32005` recovery — without the coupling to
store/AppState/midi_server, and extended with trained profiles and the `com`
stream.

### Languages

The backend **never** sends finished text: it sends a code
(`err.bulb_unreachable`) plus parameters, and the UI translates. All 52 codes
exist in English and Chinese in `ui/i18n.js`. Adding a language means adding one
block to that file.

The language picker appears on first run, and then lives in the header.

### Smoothing

`met` arrives at ~2 Hz and `com` at ~8 Hz; sending that straight through
produces visible jumps. The render thread runs at 25 fps and chases the target
with exponential smoothing (`smooth_tau`, adjustable in the UI). Hue interpolates
the short way around the circle, so blue → magenta does not sweep the rainbow.

That rate sits far above Yeelight's ~60 commands/min limit, which is why
`start_music()` is used: it swaps the connection for a reverse one (the bulb
connects back to this machine) and removes the limit. Only commands that
actually changed are sent.

### Why "adaptive" is the default

Raw `met` values sit in narrow bands that **differ per metric** — `rel` tends to
run high and `exc` low for the same person. Comparing raw values lets one metric
win almost always, and the bulb gets stuck on a single colour.

In adaptive mode each metric becomes a z-score against the person's own moving
baseline, so "strongest" means "most elevated relative to its own normal". Raw
comparison is still available under Settings → Tuning.

## Setup

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

Cortex credentials go in **Settings**, inside the app — create an application at
emotiv.com/my-account/cortex-apps. Everything the user configures is stored in
`~/.emotiv_brain_light/settings.json`, mode `600`, on this machine only:
credentials, language, bulb IP, last headset and last profile.

## How it is used

1. **Start** — connects to Cortex, authorises, and **lists the headsets**. It
   stops there.
2. **Pick a headset** from the list. There is a **Refresh** button to rescan.
   The app connects the headset and opens the session. In Performance Metrics it
   starts running right here.
3. **Mental Commands** — after the session the app lists the account's **trained
   profiles**; pick one and it loads, reads the actions, and starts running.

The last headset and profile are remembered: on later runs the app reconnects to
them on its own, and you only touch the lists to change something.

Mental Commands needs a profile trained in EMOTIV BCI with at least one action
besides Neutral, **and trained on the same headset model** — an EPOC X profile
will not load on an Insight (Cortex returns `-32226`, and the app explains that
on screen).

## Packaged builds

`.github/workflows/build.yml` builds both platforms on GitHub Actions. Run it
from the **Actions** tab, or push a `v*` tag to attach the results to a release.

| Platform | Output |
|---|---|
| macOS (Apple Silicon) | `EMOTIV-Brain-Light-macos-arm64.dmg` |
| Windows (x64) | `EMOTIV-Brain-Light-windows-x64.zip` |

Python and every library ship inside the bundle — end users install nothing.
**EMOTIV Launcher is still required**, because Cortex is what the app talks to;
packaging only removes the Python setup, not the EMOTIV software.

To build locally:

```bash
.venv/bin/pip install pyinstaller
.venv/bin/pyinstaller packaging/EmotivBrainLight.spec --noconfirm
```

### Installing on a clean machine

**Prerequisites, in order:**

1. **EMOTIV Launcher installed, signed in, and running.** The app talks to the
   Cortex service it provides. Packaging removes the Python setup, not this.
2. **A Cortex application** at emotiv.com/my-account/cortex-apps, to get a
   Client ID and secret. Each person needs their own, or shares one.
3. **The bulb on the same subnet with LAN Control enabled** in the Xiaomi Home
   app, joined to a 2.4 GHz network.

**Installing on macOS** — do not run the app from the mounted disk image. The
DMG volume is mounted read-only and flagged `quarantine`, so Gatekeeper blocks
it there and the flag cannot even be removed. Drag the app to `/Applications`
first, then:

```bash
xattr -dr com.apple.quarantine "/Applications/EMOTIV Brain Light.app"
```

On macOS 15 and newer the old right-click → *Open* trick no longer works for
unnotarised apps. The GUI route is **System Settings → Privacy & Security →
Open Anyway**, right after the blocked attempt.

macOS asks for **local network** permission on first run — allow it, or the app
reaches neither the bulb nor Cortex.

The macOS **application firewall** does not need a rule: PyInstaller ad-hoc signs
the bundle, and the firewall's default "automatically allow downloaded signed
software" covers it. Music mode needs the bulb to open a connection *back* to
this machine, so if that setting is off, allow the app when prompted.

**Installing on Windows** — unzip the whole folder and run
`EMOTIV Brain Light.exe` from inside it; the executable depends on the
`_internal/` folder beside it. SmartScreen shows "Windows protected your PC" the
first time: *More info* → *Run anyway*.

**First run** asks for a language, then the Cortex credentials under
**Settings**. Leave the bulb IP blank and press **Scan network** to find it.

**Windows** — SmartScreen shows "Windows protected your PC". Click *More info* →
*Run anyway*. The app needs the WebView2 runtime, which ships with Edge on
Windows 10 and 11.

Signing would remove both prompts, but needs an Apple Developer ID certificate
and a Windows code-signing certificate. Add `codesign_identity` in the spec and a
notarisation step to the workflow once those exist.

### Architecture coverage

The macOS build is **arm64 only** — it will not run on Intel Macs. The Windows
build is x64. Add runners to the matrix in the workflow if you need more.

## Command line

```bash
.venv/bin/python main.py --demo
```

Runs without a headset, on synthetic metrics — useful for validating the bulb,
the colours and the interpolation. `--discover` finds the bulb on the network.

## Known issues

**`start_music` returns `-5000 general error`.** The bulb accepts **one** music
mode client at a time. It is almost always an older instance still running:

```bash
ps aux | grep -E "app.py|main.py" | grep -v grep
```

Telltale sign: the bulb's brightness changes on its own while the new process
tries to connect. If there is no such process, it is an orphaned session from a
process that died without closing — the driver detects that and clears it on the
next retry.

**The bulb stops accepting TCP connections on 55443.** It supports very few
simultaneous connections; retrying while another client holds music mode
exhausts the slots and it stops answering, SSDP included. The driver uses
exponential backoff (up to 60 s) to avoid falling into this. If it happens, kill
the processes and wait. A power cycle fixes it, but is rarely necessary.

Always quit through the window or with `Ctrl+C` — both release music mode.
`kill -9` leaves the session orphaned.

**macOS firewall.** Music mode requires the bulb to open a connection *back* to
this machine. If the firewall blocks inbound connections to Python,
`start_music()` hangs. Allow the binary, or set `HOST_IP`.

**Profile with no trained action.** In Mental Commands, a profile holding only
Neutral leaves the bulb idle. The app detects that and says so instead of
pretending it works.

**Incompatible profile (`-32226`).** A profile trained on another headset model
will not load — an EPOC X profile is no good on an Insight. The list shows every
profile on the account, but only the ones for the right model will load; the app
explains this on screen when it happens.

**"A profile is already loaded" (`-32127`).** Cortex allows only one loaded
profile per headset. The app unloads the previous one before loading the next
(via `getCurrentProfile` + `setupProfile status=unload`), and when another app
loaded it — the case where `getCurrentProfile` returns `name: null` — it unloads
by target name and retries once.

**Cortex answers `warning 11` to every request.** "The APIs cannot be
registered. Please re-open the connection." The `CortexService` is wedged.
Reopening the EMOTIV Launcher window does **not** help: it is a separate root
LaunchDaemon that can stay up for weeks. Restart the service itself:

```bash
sudo launchctl kickstart -k system/com.emotiv.cortex
```

Check its uptime with `ps -o pid,etime,comm $(pgrep -f CortexService)` — if it is
measured in days, it is a candidate. The app handles warning 11 by reopening the
connection, which covers the transient case but not a permanently wedged
service.
