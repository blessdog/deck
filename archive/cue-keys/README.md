# cue-keys — TAKEAWAY, CHAPTER, NORMAL and LAVA (archived 2026-09-08)

**What they were for.** Four Stream Deck keys that shipped on 2026-09-08:

| key | did |
|---|---|
| `takeaway.ts` | showed a lower banner (text from `~/Movies/takeaway.txt`) over the current shot for ~4 s |
| `chapter.ts` | dropped a chapter marker in the recording and played a 0.7 s cyan wipe with a whoosh over the shot |
| `normal.ts` | the way out of any cue: restored the saved shot and transition, released the CUTOUT latch |
| `scene-lava-lounge.ts` | cut to the `Lava Lounge` scene (lava lamp behind the always-on `Camera FX` cutout) |

`glyphs.ts` holds their faces (banner, chapter page, lamp).

**What beat them.** Ryan deleted the four keys from the deck himself, the same
day they shipped, and said: *"I've deleted some of the Stream Deck keys that
were a waste of space that I didn't like. Don't add them again."* Law:
`knowledge/deleted-keys-stay-deleted`. `scripts/deck-layout.mjs` carries them in
`RETIRED` and `scripts/check-deck.mjs` fails if one is declared or placed again.

**Measured reason.** None — his verdict. All four were machine-exercised and
"awaiting Ryan's press"; the press was a delete.

**What stays live, on purpose.** He removed keys, not scenes. The `Takeaway`
and `Chapter` overlay scenes are still nested hidden in every speaking scene
(`obs/setup-cues.mjs`, `obs/takeaway.mjs`), the `Lava Lounge` scene and its
`Camera FX` input are still in the collection, and `plugin/src/cues.ts` still
serves REACT. CUTOUT releases by pressing CUTOUT again; NORMAL was never the
only way out. REACT releases itself on key-up.

**To run again** (if the premise changes — say a cue must be fired from a key
after all): move the three action files back under `plugin/src/actions/`, paste
the `SceneLavaLounge` class back into `scene-keys.ts`, the glyphs back into
`GLYPHS` in `key-face.ts`, and `takeaway: "Takeaway", chapter: "Chapter"` back
into `SCENES` in `obs-connection.ts`; register the four in `plugin.ts`; add the
four manifest actions (the entries are in git at `1f5e8aa`); remove the short
names from `RETIRED`; then put them back in `ACTIONS`, `VERIFY` and a grid cell
in `deck-layout.mjs` and run `build-profile.mjs`. Ask Ryan first — that is what
the law is for.
