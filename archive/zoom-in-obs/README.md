# zoom-in-obs — superseded 2026-09-02

**What it was:** `obs-zoom-to-mouse` Lua (vendored, patched for OBS 32's removed
`obs_sceneitem_get_info`), driven by the deck's ZOOM key over the websocket
(`TriggerHotkeyByName`), with `install-zoom.mjs` / `verify-zoom.mjs` to register
it and prove the hotkeys existed.

**What beat it:** macOS Accessibility Zoom sent as a plain Stream Deck Hotkey
key. Claim: `knowledge/zoom-is-native-macos-zoom.md`.

**Measured reason:** an OBS-only zoom changes the program output and nothing
else, and Ryan's eyes are on the real screen, so he cannot see the framing he
is producing. Ryan, 2026-09-02: "That way I see it directly and OBS is capturing
it. Not me guessing where it's supposed to go in the OBS capture." It also died
silently twice from path moves (2026-08-18 and again when the repo moved into
mediaStudio — OBS still pointed at `~/projects/obs-control-room/vendor/`).

**Re-run when:** OBS Display Capture stops including the system zoom. That is
Apple's behaviour (OBS maintainer, obs-studio issue #9919), so a macOS update is
the trigger to re-test. Then this is the fallback: `node install-zoom.mjs` with
OBS quit, `node verify-zoom.mjs`, restore `zoom.ts` into `plugin/src/actions`.
