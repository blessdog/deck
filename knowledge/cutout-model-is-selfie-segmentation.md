---
id: cutout-model-is-selfie-segmentation
kind: verdict
conflict-key: which-background-removal-model-runs-the-cutout
status: live
supersedes: []
scope: royshil obs-backgroundremoval 1.1.13 on CoreML, OBS 32.2.2, M-series Mac, 1920x1080 @ 30 fps, iPhone Continuity camera
evidence: evidence/2026-09-02/cutout-model-bakeoff.png
verified-on: 2026-09-02
asked-as:
  - which background removal model should the cutout use
  - why is the cutout dropping frames
  - is bria rmbg usable in OBS live
  - which model for Cam Cutout
  - background removal too slow
---

**The cutout runs `selfie_segmentation`. It is the only model that holds 30 fps
with zero skipped frames, and its edge is clean.**

Measured 2026-09-02, GetStats over 8 s per model with Ryan in frame:

| model | fps | skipped | render | picture |
|---|---|---|---|---|
| selfie_segmentation | 30.0 | 0/241 | 11.8 ms | clean |
| rvm_mobilenetv3_fp32 | 27.1 | 21/240 | 36.6 ms | clean, holes through the face on some frames |
| bria_rmbg_1_4_qint8 | 0.3 | 267/269 | 3640 ms | cleanest, unusable live |
| mediapipe | 30 | – | – | room shows through |
| SINet_Softmax_simple, pphumanseg | – | – | – | face destroyed / ghosting |

Mechanism: bria is a 1024×1024 matting network built for stills; per-frame it
costs more than a whole second. rvm is temporal and its recurrent state
occasionally drops the face region. selfie_segmentation is the MediaPipe
portrait model at 256×256, which the CoreML path runs in one frame budget.

Chroma key was the wrong tool entirely: there is no green screen. A green key
on a room punches holes in whatever is greenish (the house plant) and leaves
Ryan in.

Not verified: the macOS Vision-based remover (`obs-mac-backgroundremoval`,
Apple's Portrait engine) was not installed or measured. If selfie_segmentation
edges ever bother Ryan, that is the next candidate, not bria.

Related: [[recording-friction-is-the-product]].
