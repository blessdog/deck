---
id: speaking-looks-need-shared-audio
kind: verdict
conflict-key: why-sound-disappears-in-cutout-and-float-scenes
status: live
supersedes: []
scope: Control Room on OBS 32.2.2, Cam Cutout and Me + Float audio placement, 2026-09-08
evidence: evidence/2026-09-08/audio-coverage-before.json; evidence/2026-09-08/audio-coverage-after.json; evidence/2026-09-08/audio-recording-check.json
verified-on: 2026-09-08
asked-as:
  - why does sound disappear in Cam Cutout
  - Me Float is missing SP and app sound
  - repair audio coverage in speaking looks
---

Writer: the deck maintainer after the OBS exercise. Reader: audio setup and future
cue work. Failure if wrong: a speaking scene appears ready but drops sound.

**A scene's picture does not imply audio coverage.** Cam Cutout contained only
Camera FX; Me + Float had Mic but omitted SP-404 and App Audio. The old repair
inferred targets only from existing Mic placement, so it could never fix Cutout.

`obs/setup-audio.mjs` now explicitly includes Cam Cutout among speaking scenes
and adds missing shared Mic/SP/App inputs. Applied five additive placements;
a second dry run proposed none. Starting Soon and Ending were left alone.

A recording exercise visited Cam, Cam Cutout, Me + Float and Lava Lounge. All
three shared audio sources reported active in each look; the resulting MP4
contains four AAC tracks and non-silent App Audio in each measured interval.
This establishes app-audio coverage, not visual quality, sampler identity,
equal loudness or physical button behavior. Physical SP hits and spoken-mic
isolation still need an audible check.

Related research and remaining work:
[recording performance plan](../docs/DECK-PERFORMANCE-2026-09-08.md).
