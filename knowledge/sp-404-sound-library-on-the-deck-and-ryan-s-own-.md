---
id: sp-404-sound-library-on-the-deck-and-ryan-s-own-
kind: open
conflict-key: should-we-sp-404-sound-library-on-the-deck-and-ryan-s-own-
status: live
supersedes: []
proven: false
verified-on: 2026-09-08
asked-as:
  - SP-404 sound library on the deck, and Ryan's own recordings into it — an Ableton build, not OBS
  - sp 404 sound library on the deck and ryan s own 
  - why is  holds the MCP and the blessdog music lane) like this
  - what is blocking SP-404 sound library on the deck, and Ry
---

**This is a PLAN, not a finding. `proven: false`. Do not build against it.**

## SP-404 sound library on the deck, and Ryan's own recordings into it — an Ableton build, not OBS

**Why it matters:** Ryan is already building the SP-404 library; if the deck grows an audio section ad hoc inside the OBS keys it lands in the wrong section of the mono project and drifts — this is the ableton/ section, built after the OBS keys are solid

**Where it lands:** `obs-control-room/ableton/ (reserved section; ~/projects/mediaStudio/ABLETON/ holds the MCP and the blessdog music lane)`

**Current research:** [Recording performance, 2026-09-08](../docs/DECK-PERFORMANCE-2026-09-08.md).
Ryan explicitly resumed OBS production-value and SP soundboard work on September 8.
CoreAudio currently exposes SP-404MKII-IN/OUT. The deck's custom SP volume dial
and OBS USB input already exist. The older Ableton-loader installation claim
was not reproduced in the current user plugin directory.

**Next implementation facts:** observe MIDI mode/offsets, confirm a safe occupied
pad, and audition the recording sound palette. Evaluate the maintained
Trevligaspel MIDI plugin before writing a MIDI bridge. The sibling library's
`48 + pad - 1` arithmetic disagrees with Roland's Mode A table after pad 4;
the report gives the vendor source and row mapping. Do not reuse that arithmetic.

**Verification still needed:** physical pad/MIDI behavior and audible recording
isolation. The earlier blanket OBS deferral is superseded by Ryan's September 8
request; this remains an open plan, not a claim that MIDI cues have shipped.

Bookmarked 2026-09-02 at the moment of deferral, because the record of a deferral is what fails, not the decision to defer.
