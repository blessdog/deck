---
id: screen-capture-renders-only-while-active
kind: verdict
conflict-key: can-you-snapshot-an-inactive-screen-scene
status: live
supersedes: []
scope: OBS 32.2.2 macOS Screen Capture (ScreenCaptureKit) sources; GetSourceScreenshot over obs-websocket 5
evidence: evidence/screens-check/L-inactive.png vs L-active.png (mean 0.0 vs 0.36)
verified-on: 2026-09-02
asked-as:
  - why is the screen snapshot blank
  - snapshot of Screen L is transparent
  - GetSourceScreenshot returns empty frame
  - can I screenshot a scene that is not on program
  - check-screens says stale but the screen works
---

**A macOS Screen Capture source only delivers frames while a scene that
contains it is active (on program or preview). A screenshot of an inactive
screen scene is blank, and blank looks exactly like a stale permission.**

Measured 2026-09-02: `GetSourceScreenshot("Screen L")` while Starting Soon was
on program → mean pixel 0.0. Two seconds after `SetCurrentProgramScene("Screen
L")` → mean 0.36, real windows. Same OBS, same grant, same second.

Mechanism: ScreenCaptureKit streams are started when the source activates and
stopped when it deactivates; OBS renders the scene from the last frame, and an
inactive capture has none. Camera (`av_capture_input_v2`) sources keep
running, which is why cutout snapshots worked inactive.

How to apply: any script that snapshots a screen scene puts it on program
first, waits ~2 s, shoots, then restores program (`scripts/check-screens.mjs`
does). This is also why the README's "transparent frames on 32.1.x" note was
half right: some of those were inactive scenes, not the OBS bug.

Related: [[the-deck-ends-at-the-mp4]].
