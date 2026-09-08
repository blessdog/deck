---
id: macos-background-replacement-is-not-a-per-scene-cutout
kind: refuted
conflict-key: can-the-cutout-use-macos-video-effects-background-replacement
status: live
supersedes: []
mechanism: macOS Video Effects are a property of the camera feed as an app receives it, not of an OBS scene. The Control Center popover has one tab per app (Ryan's screenshot 2026-09-08 shows FaceTime and OBS Studio side by side), so FaceTime is unaffected — but inside OBS the replacement is painted into the Camera input that Cam, Screen + Cam, Me + Float and React all share, and Apple Community reports (thread 256168346) that it applies to every camera the app opens. No programmatic toggle exists — com.apple.controlcenter, com.apple.cameracapture and com.apple.cmio.ContinuityCaptureAgent carry no key for it, and System Events UI scripting of the Control Center camera popover returned zero elements on macOS 26.6.1 — so a CUTOUT key could not flip it in and out.
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

- It is per APP, not per scene: the OBS Studio tab of the popover governs
  every camera source OBS opens, so every scene that shows the room (Cam,
  Screen + Cam bubble, Me + Float, React) shows green — the deck records Ryan
  in his room on purpose. FaceTime's tab is separate and unaffected.
- Measured 2026-09-08 with the green on (evidence/2026-09-08/
  cutout-apple-matte-vs-vision.png): Apple's matte keyed in OBS keeps hair
  strands the Vision filter drops, and it does not lag on a fast move the way
  Vision's mask does (Ryan's screenshot: a green rim during a turn). It is the
  better edge. It still cannot be a key.
- There is no toggle a key can drive: no preference key found in the three
  camera/Control Center domains, and UI scripting the Control Center camera
  popover enumerated nothing. Flipping it by hand before each CUTOUT press is
  exactly the friction [[recording-friction-is-the-product]] forbids.

Re-check only if Apple ships a scriptable Video Effects API, or if Ryan decides the room never needs to appear in OBS — then the green stays on and a chroma key replaces the Vision latch.
