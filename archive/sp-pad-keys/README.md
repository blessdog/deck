# sp-pad-keys — deck keys that fired SP-404MKII pads over USB MIDI (archived 2026-09-08)

**What it was for.** Three Stream Deck keys (row 0, c0–c2) pointed at SP-404
bank A pads 1–3: key-down sent note-on, key-up note-off, in-process through
`@julusian/midi` (0.05 ms per pair, measured under the Stream Deck app's Node
24.13.1; the `sendmidi` CLI measured ~90 ms per spawn). `midi.ts` holds the
pad-to-note formula measured off the unit the same day (channel = bank,
pad 13 = 36, pad 1 = 48, Roland MIDI Mode A — SP-404 repo,
`knowledge/pad-to-note-map-is-top-row-first`).

**What beat it.** Ryan, 2026-09-08, the same evening it shipped: *"i have the
sp-404 as the trigger. There's no sense in having a redundant key that plays on
the stream deck."* The sampler's own pads are the soundboard. A deck key that
plays a pad duplicates a pad. Law: `knowledge/the-sp-404-is-its-own-trigger`.

**What was never proven.** Whether the unit sounds a note the Mac sends. Four
notes reached CoreMIDI while `SP-404MKII-IN` recorded digital silence; a mic
control on the same capture path had signal. Empty pads or MIDI receive off —
never separated, because the question stopped mattering.

**To run again** (if the premise changes — say a combined picture+sound cue
must be fired from one key): `cd plugin && npm install @julusian/midi`, move
both files back under `plugin/src/`, register `Pad` in `plugin.ts`, add the
manifest action `com.blessdog.obs-control-room.pad`, add `pad*` entries with
`{ bank, pad, label }` settings to `scripts/deck-layout.mjs` (the profile
writer already passes `ACTIONS[short][2]` as key settings), and restore the
`sound` tint in `key-face.ts`.
