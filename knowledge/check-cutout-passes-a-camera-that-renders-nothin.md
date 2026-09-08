---
id: check-cutout-passes-a-camera-that-renders-nothin
kind: open
conflict-key: should-we-check-cutout-passes-a-camera-that-renders-nothin
status: live
supersedes: []
proven: false
verified-on: 2026-09-08
asked-as:
  - check-cutout passes a camera that renders nothing
  - check cutout passes a camera that renders nothin
  - why is check-cutout.mjs like this
  - what is blocking check-cutout passes a camera that render
---

**This is a PLAN, not a finding. `proven: false`. Do not build against it.**

## check-cutout passes a camera that renders nothing

**Why it matters:** A dead Camera FX reads 0.997 transparent, the same as an empty room with a working cutout, so the gate cannot tell a broken camera from a good mask and would stay green while the CUTOUT key shows nothing.

**Where it lands:** `obs/check-cutout.mjs:40`

**First step:** Add a second countable line: with a person in frame, an opaque region of at least N% must exist (calibrate N with Ryan in frame), or probe Camera FX aliveness separately via GetSourceScreenshot on the raw Camera input mean brightness.

**Blocked on:** Ryan in frame to calibrate the opaque-region threshold

Bookmarked 2026-09-08 at the moment of deferral, because the record of a deferral is what fails, not the decision to defer.
