---
id: macos-background-replacement-is-not-a-per-scene-cutout
kind: refuted
conflict-key: can-the-cutout-use-macos-video-effects-background-replacement
status: live
supersedes: []
mechanism: macOS Video Effects are a property of the camera feed as an app receives it, not of an OBS scene. Background Replacement set for OBS paints the replacement into the Camera input that Cam, Screen + Cam, Me + Float and React all share — and Apple Community reports (thread 256168346) that the setting applies to every camera, not per camera. No programmatic toggle exists — com.apple.controlcenter, com.apple.cameracapture and com.apple.cmio.ContinuityCaptureAgent carry no key for it, and System Events UI scripting of the Control Center camera popover returned zero elements on macOS 26.6.1 — so a CUTOUT key could not flip it in and out.
verified-on: 2026-09-08
asked-as:
  - can I use the continuity camera virtual background for the cutout
  - macOS background replacement green screen OBS chroma key
  - why not use Apple's own portrait background removal
  - toggle video effects from the deck
  - control center background replacement AppleScript
---

**The Continuity Camera / macOS Video Effects "Background" replacement is a
dead end for the Cam Cutout scene, even though its segmentation is Apple's.**

Ryan's instinct on 2026-09-08 — Apple's own cutout is cleaner than the OBS
plugin's — was right about the engine and is honoured by
[[cutout-runs-on-apple-vision]], which reaches the same Vision framework from
inside OBS as a per-source filter. The system-level Background Replacement
route (solid green background in Control Center, chroma key in OBS — the
AppleInsider 2026-06-23 recipe) fails on scope, not on quality:

- It replaces the background on the camera feed OBS receives, so every scene
  that shows the room (Cam, Screen + Cam bubble, Me + Float, React) would show
  green — the deck records Ryan in his room on purpose.
- There is no toggle a key can drive: no preference key found in the three
  camera/Control Center domains, and UI scripting the Control Center camera
  popover enumerated nothing. Flipping it by hand before each CUTOUT press is
  exactly the friction [[recording-friction-is-the-product]] forbids.

Re-check only if Apple ships a per-app or scriptable Video Effects API.
