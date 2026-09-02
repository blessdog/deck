---
id: stream-deck-error-restoring-the-last-session-pro
kind: open
conflict-key: should-we-stream-deck-error-restoring-the-last-session-pro
status: live
supersedes: []
proven: false
verified-on: 2026-09-02
asked-as:
  - Stream Deck 'error restoring the last session' prompt after build-profile's quit/relaunch
  - stream deck error restoring the last session pro
  - why is build-profile.mjs (quit + relaunch), and the streamdeck CLI restart that follows it like this
---

**This is a PLAN, not a finding. `proven: false`. Do not build against it.**

## Stream Deck 'error restoring the last session' prompt after build-profile's quit/relaunch

**Why it matters:** If Ryan ever clicks Restore, the layout silently reverts to a stale backup — the exact failure build-profile.mjs warns about. Three quit/relaunch cycles in a row on 2026-09-02 produced the prompt even though osascript quit was used

**Where it lands:** `scripts/build-profile.mjs (quit + relaunch), and the streamdeck CLI restart that follows it`

**First step:** Reproduce: run build-profile twice within a minute; check whether the prompt is from relaunching before the app finishes writing its session, and if so wait for the profile files' mtime to settle before open -a

Bookmarked 2026-09-02 at the moment of deferral, because the record of a deferral is what fails, not the decision to defer.
