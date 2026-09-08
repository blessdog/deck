---
id: cutout-is-a-latch-on-the-shared-camera
kind: verdict
conflict-key: how-the-cutout-key-works-across-scenes
status: live
supersedes: []
scope: Control Room on OBS 32.2.2, mac_vision_filter on the shared Camera input, Source Record 0.4.8 on the separate Camera Raw input, Stream Deck plugin action com.blessdog.obs-control-room.cutout
evidence: evidence/2026-09-08/cutout-latch-in-every-scene.png (Cam, Screen + Cam, Me + Float, React with the latch on); evidence/2026-09-08/cutout-latch-iso-stays-raw.png (main near-black 0.731 vs ISO 0.037 on the same take, after the ISO moved to Camera Raw; before the move both were 0.797)
verified-on: 2026-09-08
asked-as:
  - cutout in whatever scene I'm in
  - why is the ISO recording a cutout
  - camera ISO has a black background
  - what is the Camera Raw input for
  - what is the Rig scene
  - CUTOUT key is a toggle not a scene
  - does NORMAL turn off the cutout
---

**CUTOUT is a latch, not a scene: the key enables the Mac Vision filter on the
shared Camera, so whatever shot is up — Cam, Screen + Cam, Me + Float, React —
loses its room in place. Press again, or NORMAL, and the room is back. The
Camera ISO records a THIRD input, Camera Raw, that nothing else touches.**

Ryan, 2026-09-08: *"I already have a cam scene. What I want is to be able to
hit cutout in whatever scene I'm in, and it cuts out the background. Just has
me free-floating in it."*

Measured the same day:

| check | result |
|---|---|
| latch on, Cam on program, transparent ratio | 0.69–0.76 |
| latch off, same | 0.000 |
| Cam Cutout (Lava's own Camera FX, untouched) | 0.73 |
| ISO from the shared Camera, latch on | **0.797 near-black — a cutout, same as main** |
| ISO from Camera Raw, latch on | 0.037 near-black — the raw room; main 0.731 |

Mechanism of the ISO failure: Source Record renders `obs_filter_get_parent`,
the whole source with every filter on it, so no position in the chain keeps a
recorder upstream of the latch. The only frame nobody has cut is one from a
different input. Camera Raw opens the same device a third time (Camera and
Camera FX already did), parked disabled in the hidden `Rig` scene because an
input must belong to a scene; Source Record's own showing-count keeps it
rendering. The Camera Picker re-points all three.

How to apply: `obs/lib/cutout.mjs` names the three inputs; `obs/add-look.mjs
iso` moves the recorder, `obs/add-look.mjs cutout` installs the latch and
refuses if a recorder is still on Camera; `obs/check-cutout.mjs` exercises
on, off, the split and Lava. Pressed on a screen-only scene the latch arms with
nothing to show until a camera scene goes up — that is the latch working.

Related: [[cutout-runs-on-apple-vision]], [[camera-iso-rides-along-with-every-recording]],
[[macos-background-replacement-is-not-a-per-scene-cutout]].
