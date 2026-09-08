---
id: midi-ts-available-builds-a-coremidi-client-per-p
kind: open
conflict-key: should-we-midi-ts-available-builds-a-coremidi-client-per-p
status: live
supersedes: []
proven: false
verified-on: 2026-09-08
asked-as:
  - midi.ts available() builds a CoreMIDI client per probe
  - midi ts available builds a coremidi client per p
  - why is midi.ts like this
---

**This is a PLAN, not a finding. `proven: false`. Do not build against it.**

## midi.ts available() builds a CoreMIDI client per probe

**Why it matters:** Every render with no open port constructs a fresh Output, plus one every 10 s from the pad reconcile timer; GC reclaims them but it is a CoreMIDI client churn that a single long-lived probe Output avoids. Not a fault today, a tidy for the next plugin rebuild.

**Where it lands:** `plugin/src/midi.ts:70`

**First step:** Keep one probe Output on the SPMidi instance for enumeration; only openPort on the shared out.

Bookmarked 2026-09-08 at the moment of deferral, because the record of a deferral is what fails, not the decision to defer.
