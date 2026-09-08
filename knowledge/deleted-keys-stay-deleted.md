---
id: deleted-keys-stay-deleted
kind: law
conflict-key: what-happens-when-ryan-deletes-a-deck-key
status: live
supersedes: []
verified-on: 2026-09-08
asked-as:
  - where did the takeaway key go
  - where is the chapter key
  - where is the normal key
  - where is the lava lounge key
  - Ryan deleted keys from the stream deck
  - should I add the cue keys back
  - how do I turn cutout off without NORMAL
  - build-profile put a key back that was removed
---

**"I've deleted some of the Stream Deck keys that were a waste of space that I
didn't like. Don't add them again."** (Ryan, 2026-09-08.)

A key Ryan removes from the deck himself is a verdict, and the layout follows
the deck — never the other way round. On 2026-09-08 he deleted **TAKEAWAY,
CHAPTER, NORMAL and LAVA**, all four shipped that same day "awaiting his
press"; the press was a delete. `scripts/deck-layout.mjs` names them in
`RETIRED`, their cells are dark, and `scripts/check-deck.mjs` fails the build if
a retired short name is declared in `ACTIONS` or placed on any grid. The code
is runnable in `archive/cue-keys/` with the reason on top.

Why a gate and not a note: `build-profile.mjs` writes the layout onto the
deck. With the four still in the layout, the next run would have put every one
of them back, silently, and the only signal would have been Ryan noticing. The
tripwire's existing checks could not see it — a shipped action with no key
looks the same whether Ryan removed it or nobody placed it yet — so the
retirement has to be stated, not inferred.

What this does NOT remove: he deleted keys, not scenes. `Takeaway`, `Chapter`
and `Lava Lounge` remain in the collection, `obs/setup-cues.mjs` and
`obs/takeaway.mjs` still work, and `cues.ts` still serves REACT. CUTOUT
releases by pressing CUTOUT again; REACT releases on key-up.

Related: [[the-sp-404-is-its-own-trigger]] (same day, same shape),
[[recording-friction-is-the-product]], [[cutout-is-a-latch-on-the-shared-camera]].
