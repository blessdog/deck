---
id: the-sp-404-is-its-own-trigger
kind: law
conflict-key: does-the-deck-fire-sampler-pads
status: live
supersedes: [sp-404-sound-library-on-the-deck-and-ryan-s-own-, midi-ts-available-builds-a-coremidi-client-per-p]
verified-on: 2026-09-08
asked-as:
  - should the deck have sound keys
  - can a stream deck key play an SP-404 pad
  - WIN OOPS THINK keys on the deck
  - deck to SP-404 MIDI trigger
  - why are there no pad keys on the deck
  - where does the soundboard live
---

**"i have the sp-404 as the trigger. There's no sense in having a redundant key
that plays on the stream deck." — "a1 a2 a3 are a clunkier version of what the
SP does. That's its one job."** (Ryan, 2026-09-08, the evening three pad keys
shipped.)

The sampler's pads ARE the soundboard. The deck never fires a pad, never hosts
a sound bank, never duplicates a pad as a key. The SP's part in a recording is
its USB audio into the shared `SP-404` input and onto its own track; the deck's
part is the picture and the recording. The two meet in OBS, not on a key.

What this means for the plan in `docs/DECK-PERFORMANCE-2026-09-08.md`: order 2
("recording sound bank, deck bindings") loses its deck half entirely — the bank
is built on the SP, by Ryan, in the Roland app. Order 4 "combined
picture-and-sound cues" cannot fire the SP from a deck key; if a pad should ever
drive a visual, the direction is SP → OBS (MIDI in, Advanced Scene Switcher was
the candidate), never deck → SP. `SFX STOP` on the deck is gone with it; the SP
has its own stop.

The three keys that lived at row 0 c0–c2 for one evening, with the in-process
MIDI sender and the measured pad-to-note formula, are in
`archive/sp-pad-keys/` with the reason on top. The pad map itself stays true in
the SP-404 repo (`knowledge/pad-to-note-map-is-top-row-first`) — it is about
the instrument, not the deck.

Related: [[recording-friction-is-the-product]], [[the-deck-ends-at-the-mp4]].
