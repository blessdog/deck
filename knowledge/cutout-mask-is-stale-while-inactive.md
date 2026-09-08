---
id: cutout-mask-is-stale-while-inactive
kind: verdict
conflict-key: can-you-snapshot-an-inactive-cutout-scene
status: live
supersedes: []
scope: royshil obs-backgroundremoval 1.1.13 (selfie_segmentation, CoreML) on the Camera FX input, OBS 32.2.2, GetSourceScreenshot over obs-websocket 5, Cam Cutout not on program or preview
evidence: evidence/2026-09-08/cutout-inactive.png (0.727, person-shaped hole over the EMPTY room) vs cutout-active-3s.png (0.999) vs evidence/cutout-check.png from the failing run (0.000, fully opaque, Ryan and room)
verified-on: 2026-09-08
asked-as:
  - check-cutout fails but the cutout key works
  - cutout snapshot shows the room through a person-shaped hole
  - transparent ratio 0.000 on Cam Cutout
  - can I screenshot Cam Cutout when it is not on program
  - background removal mask is wrong in a screenshot
---

**The background-removal mask only refreshes while the Camera FX source is
actively rendering. A screenshot of Cam Cutout while it is inactive applies a
STALE mask — or none — to a fresh camera frame, so the picture lies in both
directions: a person-shaped hole over an empty room, or a fully opaque room.**

Measured 2026-09-08, same OBS session, same filter settings, minutes apart:

| condition | transparent ratio | what the picture showed |
|---|---|---|
| inactive, `npm run check` | 0.000 | Ryan and the whole room, opaque |
| inactive, a few minutes later | 0.727 | Ryan-shaped hole, but the frame was the empty room |
| 1 s on program | 0.998 | empty room fully removed |
| 3 s on program | 0.999 | same |
| 6 s on program | 0.843 | Ryan walking back in, mask following |

Mechanism: the camera input keeps delivering frames when inactive (so
[[screen-capture-renders-only-while-active]] does not apply to the pixels),
but the filter's segmentation runs on the render path, and an inactive source
is not rendered — so the mask it last computed is what a one-off screenshot
composites, against whatever frame the camera has now. This refines the older
verdict's line "cutout snapshots worked inactive": they worked by luck of a
recent activation.

How to apply: any script that measures Cam Cutout puts it on program first,
waits ~2 s, shoots, then restores program, and never switches while a
recording is live — `obs/check-cutout.mjs` does since 2026-09-08. A threshold
on transparent ratio alone still passes a camera that renders nothing
(0.997 with nobody in frame); a mask check with a person in frame is Ryan's
press ladder, not this script.

Related: [[cutout-model-is-selfie-segmentation]].
