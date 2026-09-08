---
id: sp-404-sound-library-on-the-deck-and-ryan-s-own-
kind: open
conflict-key: should-we-sp-404-sound-library-on-the-deck-and-ryan-s-own-
status: superseded
supersedes: []
proven: false
verified-on: 2026-09-08
asked-as:
  - SP-404 sound library on the deck, and Ryan's own recordings into it — an Ableton build, not OBS
  - sp 404 sound library on the deck and ryan s own 
  - why is  holds the MCP and the blessdog music lane) like this
  - what is blocking SP-404 sound library on the deck, and Ry
---

**RETIRED 2026-09-08 by [[the-sp-404-is-its-own-trigger]]: the deck does not fire pads.**

## SP-404 sound library on the deck, and Ryan's own recordings into it — an Ableton build, not OBS

**Why it matters:** Ryan is already building the SP-404 library; if the deck grows an audio section ad hoc inside the OBS keys it lands in the wrong section of the mono project and drifts — this is the ableton/ section, built after the OBS keys are solid

**Where it lands:** `obs-control-room/ableton/ (reserved section; ~/projects/mediaStudio/ABLETON/ holds the MCP and the blessdog music lane)`

**Current research:** [Recording performance, 2026-09-08](../docs/DECK-PERFORMANCE-2026-09-08.md).
Ryan explicitly resumed OBS production-value and SP soundboard work on September 8.
CoreAudio currently exposes SP-404MKII-IN/OUT. The deck's custom SP volume dial
and OBS USB input already exist. The older Ableton-loader installation claim
was not reproduced in the current user plugin directory.

**Measured 2026-09-08, so no longer open questions:** the pad-to-note map is
channel = bank, pad 13 = 36, pad 1 = 48 (Roland MIDI Mode A), filed in the
SP-404 repo as `knowledge/pad-to-note-map-is-top-row-first`, and the formula
lives in `plugin/src/midi.ts` only. Three `pad` keys ship on the deck pointed
at bank A pads 1–3 (provisional labels). Trevligaspel was evaluated and passed
over: no OBS state, no combined cues; `@julusian/midi` in-process at 0.05 ms.

**Still open, and what this item now waits on:** whether the unit SOUNDS a note
the Mac sends (USB audio in recorded silence while four notes went out; one
physical pad press during a joint capture separates empty pads from receive
off); which bank hosts the recording bank; the sound palette; headphone
routing. Then the bank itself is built in the Roland app (drag-and-drop; no
MIDI path loads samples) and the three keys are re-pointed and re-labelled.

Bookmarked 2026-09-02 at the moment of deferral, because the record of a deferral is what fails, not the decision to defer.
