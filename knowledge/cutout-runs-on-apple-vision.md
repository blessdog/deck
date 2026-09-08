---
id: cutout-runs-on-apple-vision
kind: verdict
conflict-key: which-background-removal-model-runs-the-cutout
status: live
supersedes: [cutout-model-is-selfie-segmentation]
scope: obs-mac-backgroundremoval 0.3.6 (andrewleejenkins fork, filter kind mac_vision_filter) on the Camera FX input, OBS 32.2.2, macOS 26.6.1, M-series Mac, 1920x1080 @ 30 fps, iPhone 14 Pro Continuity camera
evidence: evidence/2026-09-08/cutout-vision-bakeoff.png (selfie_segmentation vs Vision balanced vs Vision accurate, same scene, minutes apart)
verified-on: 2026-09-08
asked-as:
  - which background removal model should the cutout use
  - the cutout edge is wobbly
  - cutout has a halo around the hair
  - is there a tighter cutout than obs-backgroundremoval
  - which filter is on Camera FX
  - background removal too slow
  - mac_vision_filter settings
---

**The cutout runs Apple's Vision person segmentation through the
`mac_vision_filter` filter (obs-mac-backgroundremoval), quality *balanced*,
processing scale 0.5, protected region off. It is tighter than
selfie_segmentation and costs a fifth of the render time.**

Measured 2026-09-08, GetStats over 8 s each with Ryan in frame, Cam Cutout on
program (so the mask was fresh — [[cutout-mask-is-stale-while-inactive]]):

| remover | fps | render skipped | render | edge |
|---|---|---|---|---|
| royshil selfie_segmentation (CoreML) | 30 | 0/241 | 13.0 ms | soft halo; room fringe on hair and shoulder |
| Vision balanced, scale 0.5 | 30 | 0/241 | 2.8 ms | tight, smooth |
| Vision accurate, scale 1.0 | 30 | 0/241 | 5.3 ms | tight, but stair-stepped at the hair |

Mechanism: selfie_segmentation is a 256×256 model, so its mask is stretched
about 7.5× to cover 1920×1080 and the stretch is the wobble — no threshold,
feather or smoothing knob on that filter can add resolution the mask never had.
Vision segments at the source resolution the scale allows, and its
*accurate* mode at full scale exposes the mask's own pixel grid instead, hence
the staircase; *balanced* at half scale smooths it without the fringe.

Not a matte: hair is still cut hard, as a binary-ish person mask. If Ryan ever
wants strand-level hair, that is a matting network (bria was the cleanest and
unusable live at 0.3 fps — see the archived claim), not a Vision knob.

How to apply: `obs/lib/cutout.mjs` is the one place the filter and its settings
are named; `obs/add-look.mjs cutout` installs or repairs it, `obs/setup-scenes.mjs`
builds it fresh. The royshil filter stays on Camera FX, disabled, so the
2026-09-02 bake-off can be re-run if a premise changes.

Related: [[macos-background-replacement-is-not-a-per-scene-cutout]].
