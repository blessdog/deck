---
id: plugin-build-warns-ts2339-property-on-does-not-e
kind: open
conflict-key: should-we-plugin-build-warns-ts2339-property-on-does-not-e
status: live
supersedes: []
proven: false
verified-on: 2026-09-03
asked-as:
  - Plugin build warns TS2339 'Property on does not exist on OBSConnection' at all 29 obs.on sites
  - plugin build warns ts2339 property on does not e
  - why is obs-connection.ts like this
---

**This is a PLAN, not a finding. `proven: false`. Do not build against it.**

## Plugin build warns TS2339 'Property on does not exist on OBSConnection' at all 29 obs.on sites

**Why it matters:** Warnings that always fire train everyone to ignore the build output, which is how a real type error will slip through next time

**Where it lands:** `plugin/src/obs-connection.ts:62 (class OBSConnection extends EventEmitter<ObsEvents>) and plugin/tsconfig.json`

**First step:** Check @types/node version against the generic EventEmitter<T> signature; either bump @types/node or declare the on/emit overloads on OBSConnection explicitly

Bookmarked 2026-09-03 at the moment of deferral, because the record of a deferral is what fails, not the decision to defer.
