---
id: camera-iso-rides-along-with-every-recording
kind: verdict
conflict-key: how-the-camera-track-is-kept-separate-from-the-screen
status: live
supersedes: []
scope: OBS 32.2.2 + Source Record 0.4.8 filter on the shared Camera input, hybrid MP4 main recording, Apple VT h264
evidence: 12 s test 2026-09-03 — ~/Movies/2026-09-03_14-41-39.mp4 (11.83 s, h264 1080p, 4 AAC tracks) and ~/Movies/iso/2026-09-03_14-41-39-cam.mp4 (11.50 s, h264 1080p, 1 AAC)
verified-on: 2026-09-03
asked-as:
  - how do I get a clean camera track separate from the screen
  - where is the camera iso file
  - can I reframe the camera after recording
  - source record settings for the camera
  - why are there two files per recording
---

**Every recording writes a second file: the camera alone, with mic, same
timestamp, `-cam` suffix, in `<record dir>/iso/`. It is a Source Record
filter on the shared Camera input in mode 3 (follows the main recording).**

Why: Ryan cuts several snippets together in Resolve. With the camera as its
own track, bubble ↔ full-bleed ↔ cutout is an edit decision, not a re-shoot.

Settings that matter (`obs/add-look.mjs iso`): `record_mode: 3`, same encoder
as the main file (`com.apple.videotoolbox.videoencoder.ave.avc`, AAC), mic
carried on the ISO (`different_audio: true, audio_source: "Mic"`), no scaling.
Cost: a second 1080p h264 file per take (~ the same size as the camera share
of the main file).

The ISO starts ~0.3 s after the main file (11.50 vs 11.83 s on the test);
ingest aligns on the shared timestamp name, not on frame count.

Related: [[the-deck-ends-at-the-mp4]].
