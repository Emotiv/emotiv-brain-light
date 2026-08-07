# PyInstaller spec for the macOS .app bundle and the Windows folder build.
#
#   pyinstaller packaging/EmotivBrainLight.spec --noconfirm
#
# Run it from the repository root — the paths below are relative to it.
import os
import sys

from PyInstaller.utils.hooks import collect_all

APP_NAME = "EMOTIV Brain Light"
# SPECPATH is injected by PyInstaller and points at packaging/; every path below
# is built from the repo root so the spec works from any working directory.
ROOT = os.path.abspath(os.path.join(SPECPATH, os.pardir))
IS_MAC = sys.platform == "darwin"


def at(*parts):
    return os.path.join(ROOT, *parts)

# pywebview loads its platform backend dynamically, so PyInstaller cannot see it
# by static analysis. collect_all pulls the platform modules and their deps
# (pyobjc on macOS, pythonnet/WebView2 on Windows).
webview_datas, webview_binaries, webview_hidden = collect_all("webview")

platform_hidden = (
    ["webview.platforms.cocoa"] if IS_MAC else ["webview.platforms.edgechromium", "clr"]
)

a = Analysis(
    [at("app.py")],
    pathex=[ROOT],
    binaries=webview_binaries,
    datas=webview_datas
    + [
        # The UI is read from disk at runtime; resource_dir() in app.py resolves
        # sys._MEIPASS so these land where it looks for them.
        (at("ui"), "ui"),
        # Cortex serves wss:// with a self-signed chain, so its root CA travels
        # with the app.
        (at("certificates"), "certificates"),
    ],
    hiddenimports=webview_hidden
    + platform_hidden
    + [
        "yeelight",
        "websockets",
        "dotenv",
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "numpy", "PIL"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name=APP_NAME,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=at("packaging", "icon.ico") if os.path.exists(at("packaging", "icon.ico")) else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name=APP_NAME,
)

if IS_MAC:
    app = BUNDLE(
        coll,
        name=f"{APP_NAME}.app",
        icon=at("packaging", "icon.icns") if os.path.exists(at("packaging", "icon.icns")) else None,
        bundle_identifier="com.emotiv.brainlight",
        info_plist={
            "CFBundleName": APP_NAME,
            "CFBundleDisplayName": APP_NAME,
            "CFBundleShortVersionString": "0.1.0",
            "CFBundleVersion": "0.1.0",
            "NSHighResolutionCapable": True,
            "LSMinimumSystemVersion": "11.0",
            # The app reaches the bulb over the LAN and Cortex on localhost.
            # Without this key recent macOS versions block both silently.
            "NSLocalNetworkUsageDescription": (
                "EMOTIV Brain Light needs the local network to find and control "
                "your Yeelight bulb, and to reach the EMOTIV Cortex service."
            ),
            "NSBonjourServices": ["_yeelight._tcp"],
        },
    )
