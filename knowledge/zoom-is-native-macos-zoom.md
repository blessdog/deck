---
id: zoom-is-native-macos-zoom
kind: law
conflict-key: which-zoom-the-deck-drives
status: live
supersedes: []
verified-on: 2026-09-02
asked-as:
  - which zoom should the zoom key use
  - should we use the obs zoom to mouse lua
  - should we install zoominator
  - how does the zoom key work
  - why not zoom inside OBS
---

**The ZOOM key drives macOS Accessibility Zoom, not an OBS-side zoom. Ryan
zooms the screen he is looking at, and OBS records what the compositor shows.**

Ryan, 2026-09-02: *"That's the right way I want to do the zoom feature. That
way I see it directly and OBS is capturing it. Not me guessing where it's
supposed to go in the OBS capture because I'm concentrating on the actual
screen share, not the OBS."*

Mechanism: an in-OBS zoom (the vendored obs-zoom-to-mouse Lua, Zoominator)
changes only the program output. Ryan's attention is on the real screen, so
he cannot see the framing he is producing. System zoom puts the framing where
his eyes already are. OBS Display Capture records the composited image
including the zoom — OBS maintainer on issue #9919: "We use the image that
macOS gives us, and that includes the zoom."

How to apply: the deck key sends the system zoom hotkeys (⌥⌘8 toggle, ⌥⌘= in,
⌥⌘− out) via the Stream Deck Hotkey action, or a hold-to-zoom variant. The
Lua and any OBS zoom plugin move to `archive/` with this claim as the reason.
Zoom must be exercised and snapshotted through OBS after any macOS update:
capture of accessibility features is Apple's behaviour, not ours.

Related: [[recording-friction-is-the-product]].
