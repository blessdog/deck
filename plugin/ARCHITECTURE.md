# OBS Control Room — Plugin Architecture, Findings & Roadmap

*Report-before-build deliverable. Research verified against primary sources
(2026-07-22). Verification tags: **[V-docs]** official docs, **[V-gh]** vendor
GitHub/npm, **[V-proto]** obs-websocket `protocol.md`, **[2nd]** secondary,
**[?]** uncertain.*

---

## 0. Executive summary & the one decision that gates everything

We are **not** starting from zero. `plugin/` already contains a well-built
plugin on the **current** official stack: `@elgato/streamdeck` 2.1, `@elgato/cli`
1.6, `obs-websocket-js` 5, Node 24, Rollup, SDKVersion 3. Its `obs-connection.ts`
(reconnect loop + SSOT config read + cold-start) and `key-face.ts` (one SVG
generator, glyph/color grammar) are **genuine assets we build on, not replace**
(bible §5.3 salvage-with-discipline).

But the existing plugin is a **hardcoded personal instrument**, and this request
describes a **generic, configurable, reusable, paid-grade product**. That gap is
real and it is the whole ballgame:

| Requested | Exists today | Gap |
|---|---|---|
| Reusable actions | 1 action **class per scene** (`SceneStartingSoon`…); scene/input names are compile-time constants | Need a config layer |
| Clean property inspector | **Zero PIs.** No `PropertyInspectorPath`, no `sdpi-components`, no settings model | Build from scratch |
| Import/export presets | None | Build |
| Studio-mode preview/live, source animation, replay buffer, transitions, generic source visibility, generic audio, macros | Not present | Build |
| Distributable / cross-platform | Mac-only, single-user (`/Users/SSDrive`, CoreGraphics, `open -a OBS`) | Depends on the decision below |

**THE decision (§7):** is this becoming a **distributable Marketplace product**
(full BarRaider-class: generic everything, cross-platform, connection-config UI),
or a **configurable personal instrument** (grow a generic engine, add the missing
workflows, but stay scoped to this Mac)? It changes cross-platform scope, how
connection config works, and how much of the bespoke layer we generalize. I have
a recommendation (hybrid) but it is yours to make.

**Asymmetric-optionality flag (keystone principle, zero-cost/uncapped):** the
Elgato **Maker Console account + Marketplace maker handle** and the plugin
**UUID reverse-DNS namespace** are first-come and claimable now for free —
worth securing regardless of which fork you pick. **[V-docs]**

---

## 1. Current-state audit (what's in `plugin/` today)

**Stack** (from `package.json`, `manifest.json`): `@elgato/streamdeck ^2.1.0`,
`obs-websocket-js ^5.0.6`, `@elgato/cli ^1.6.0`, Rollup, TS 5.6, Node 24,
SDKVersion 3, `mac` only, min Stream Deck 7.1. This matches current best practice
per the SDK research — no framework upgrade needed.

**Infrastructure (keep + generalize):**
- `src/obs-connection.ts` — singleton `obs` `EventEmitter`. Persistent
  connect/reconnect loop (`RETRY_MS`), reads port/password from **OBS's own
  websocket config file** (SSOT), error-207 readiness poll, `ensureOBS()`
  cold-start (`open -a OBS`), `poke()` on wake, forwards 6 OBS events. This
  already solves the field's **#1 complaint** (connection fragility) better than
  `obs-websocket-js` does natively (the library has **no** auto-reconnect —
  **[V-gh]**).
- `src/key-face.ts` — single `face()` SVG generator → data-URI for `setImage`.
  `GLYPHS`, `COLORS`, `fmtDuration`. This is the rendering SSOT.

**Action pattern (consistent, good):** every action extends `SingletonAction`,
subscribes to `obs` events in its constructor, `onWillAppear`→refresh,
`onKeyDown`→act in try/catch→`showAlert`/`showOk`, `render()` loops
`this.actions` calling `setImage`. 17 actions registered in `plugin.ts`.

**The anti-pattern for "reusable":** `scene-keys.ts` is 8 subclasses that differ
only by two constants (`scene`, `label`). `mute-mic.ts` hardcodes `MIC = "Mic"`.
`camera-picker.ts` hardcodes `"Camera"`/`"Camera FX"`. Adding a scene = edit code
+ edit manifest + rebuild. **This is exactly what a property inspector + typed
settings removes.**

**Deliberate design tension to respect:** the README "State — 2026-07-21"
sections are emphatic that the deck is zero-config and bespoke *on purpose*
("the deck does one thing well — OBS"; face grammar locked). Generalizing must
**not** regress that finger-feel. Resolution: bespoke keys survive as a **preset
layer** on the generic engine (bible §5.1 convergence — both call the same
functions), so muscle memory is preserved while the engine becomes reusable.

---

## 2. Research findings (synthesized, verified)

### 2A. Official Stream Deck SDK — what we build with

- **Toolchain** is exactly what's already here. `@elgato/streamdeck` 2.1.0 (Node
  ≥20.5.1), `@elgato/cli` 1.7.4 (`streamdeck create/link/dev/pack/validate/restart`),
  `sdpi-components` v4 for the PI. **[V-gh]/[V-docs]**
- **Actions** = `@action({UUID})` + `SingletonAction<Settings>` classes; one
  class instance serves every on-screen copy; per-key state lives in **settings**
  keyed by `ev.action.id`. Full event set: `onWillAppear/DisAppear`,
  `onKeyDown/Up`, `onDialDown/Up/Rotate`, `onTouchTap`, `onDidReceiveSettings`,
  `onPropertyInspectorDidAppear/DisAppear`, `onSendToPlugin`,
  `onTitleParametersDidChange`; top-level `streamDeck.system.onSystemDidWakeUp`,
  `streamDeck.settings.onDidReceiveGlobalSettings`, `streamDeck.devices.*`. **[V-docs]**
- **Key feedback:** `setImage` (SVG/PNG data-URI — **not** GIF **[?]**),
  `setTitle`, `setState` (max **2** states/key), `showOk`/`showAlert`. Dynamic
  art = build SVG string → `data:image/svg+xml,${encodeURIComponent(svg)}`
  (this is precisely what `key-face.ts` already does). **[V-docs]**
- **Property Inspector:** HTML in `ui/`, `PropertyInspectorPath` per action.
  `sdpi-components` gives declarative `<sdpi-item>`, `<sdpi-textfield/select/
  range/checkbox>` where `setting="x"` **two-way-binds to settings with zero
  code**. **Datasource dropdowns**: `<sdpi-select datasource="getScenes">` fires
  `sendToPlugin`, plugin replies via `sendToPropertyInspector` with
  `{event, items:[{label,value}]}` — **this is how we populate scene/source/input
  dropdowns live from OBS.** **[V-docs]**
- **Settings:** per-action (`ev.payload.settings`, `setSettings`, typed via
  `SingletonAction<T>`) and global (`streamDeck.settings.get/setGlobalSettings`).
  TS types are compile-time only — validate complex settings at runtime. **[V-docs]**
- **Stream Deck +** (dials): `Controllers:["Encoder"]`, `onDialRotate`
  (`ev.payload.ticks`), `setFeedback({title,value,indicator})`, layouts
  `$B1`/`$B2` — the path for a **volume dial**. **[V-docs]**
- **Packaging:** `streamdeck pack` → `.streamDeckPlugin` (validates first). No
  maker code-signing/notarization required (unlike OBS plugins). Marketplace via
  Maker Console. **[V-docs]**
- **Debug:** `streamdeck dev` → Node debugger + **PI remote-debug in Chrome at
  `localhost:23654`**; `streamDeck.logger` → `logs/<uuid>.0.log`. **[V-docs]**

### 2B. Competitive landscape — what pro users actually value

BarRaider **OBS Tools** (v3.5, **free**, Windows-only, closed-source now) and the
**official Elgato OBS Studio** plugin (v3.0.3, free, Mac+Win) bracket the field.
The recurring **differentiators** (what makes a plugin feel pro):

1. **Live scene-*thumbnail* on the key** with preview-vs-live **border color**
   (BarRaider Smart Scene Switcher) — the single most-praised feature; nobody
   else nails it. Implemented via `GetSourceScreenshot`. **[V-docs/2nd]**
2. **Instant Replay** — long-press arms the buffer; BarRaider adds Twitch
   `!replay` chat trigger + auto-clip. Signature pro feature. **[V-docs]**
3. **Health telemetry keys** — Dropped-Frames Alarm (color-shifts on
   degradation), CPU%. Turns keys into a dashboard. **[V-docs]**
4. **Source Animation with record + import/export** — multi-phase source motion
   without a multi-action; shareable presets. Official plugin has nothing like
   it. **[V-docs]**
5. **Smart toggles that reflect real OBS state** (mute/filter/studio) — read back,
   never fire blind. (Our existing keys already do this.) **[V-docs]**
6. **Multi-behavior audio**: one Mute action offering toggle / push-to-talk /
   push-to-mute (official plugin). **[V-docs]**
7. **Volume via dial** (Stream Deck +). **[V-docs]**
8. **Automation/rules** (event→action) is siloed behind **Aitum Nexus paywall**
   ($4.99/mo) — an opening for a free macro layer. **[2nd]**

**Official plugin breadth we should match:** stream/record/**record-pause**/
virtual-cam/**replay-save**/studio-mode/**preview-push**/**chapter-marker**/
**screenshot**; scene / **scene-collection** / **profile** / transition switch;
source show-hide; filter toggle; **mute (toggle/PTT/PTM)** + media control +
audio-mixer dial; live status feedback + multi-action. **[V-mktplace]**

**#1 user complaint across the whole field: connection fragility** — timeouts,
keys stuck on error images, re-run-the-wizard-to-reconnect. Our `obs-connection`
reconnect loop is already the right answer; we should **lean into robust
reconnect + honest on-key diagnostics as a stated selling point.** **[2nd]**

### 2C. OBS-WebSocket v5 — verified capability map (what OBS can do)

Bundled with OBS 28+, RPC v1, default `ws://127.0.0.1:4455`, SHA256 challenge
auth (library computes it). `EventSubscription` is a bitmask; **`All` (2047)
excludes high-volume bits** — `InputVolumeMeters` (1<<16) and
`SceneItemTransformChanged` (1<<19) must be OR-ed in explicitly. **[V-proto]**

| Workflow | Requests | Live event (seed with Get… then follow) |
|---|---|---|
| Scene switch | `GetSceneList`, `SetCurrentProgramScene` | `CurrentProgramSceneChanged` |
| Studio/preview | `GetStudioModeEnabled`, `SetCurrentPreviewScene`, `TriggerStudioModeTransition` | `StudioModeStateChanged`, `CurrentPreviewSceneChanged` |
| Source visibility | `GetSceneItemId`→`SetSceneItemEnabled` (per **sceneItemId**, not source) | `SceneItemEnableStateChanged` |
| Source animation | `Get/SetSceneItemTransform` — **no native tween**; step client-side or `SerialFrame` batch, or delegate to **Move** plugin via `CallVendorRequest` | `SceneItemTransformChanged` (high-vol) |
| Transitions | `Get/SetCurrentSceneTransition`, `SetCurrentSceneTransitionDuration`, `TriggerStudioModeTransition` | `CurrentSceneTransitionChanged` |
| Replay buffer | `Get/Start/Stop/ToggleReplayBuffer`, `SaveReplayBuffer`, `GetLastReplayBufferReplay` | `ReplayBufferStateChanged`, `ReplayBufferSaved` |
| Record/stream/vcam | `Get*Status`, `Start/Stop/Toggle*`, `Pause/ResumeRecord`, `SplitRecordFile` | `RecordStateChanged`, `StreamStateChanged`, `VirtualcamStateChanged` (carry `outputState` incl. STARTING/STOPPING) |
| Audio | `GetInputList(inputKind)`, `Get/SetInputVolume` (mul or dB), `Get/Set/ToggleInputMute`, `Get/SetInputAudioMonitorType` | `InputMuteStateChanged`, `InputVolumeChanged`; **`InputVolumeMeters`** for VU (high-vol, ~50ms) |
| Filters | `GetSourceFilterList`, `SetSourceFilterEnabled`, `SetSourceFilterSettings` | `SourceFilterEnableStateChanged` |
| Key thumbnail | `GetSourceScreenshot` (scene name works; returns base64 `data:` URI → straight into `setImage`) | poll ~1–4 Hz, key-sized, jpg — self-throttle |
| Macros | `callBatch(requests, {executionType, haltOnFailure})` + `Sleep` (`sleepMillis`/`sleepFrames`) — atomic server-side sequences | — |
| Misc | `GetVersion` (capability oracle: `availableRequests`, `supportedImageFormats`), `GetStats`, `TriggerHotkeyByName`, `Get/SetCurrentSceneCollection`, `Get/SetCurrentProfile`, `CallVendorRequest` (3rd-party plugins) | `CurrentSceneCollection/ProfileChanged`, `VendorEvent` |

**Gotchas:** `GetSourceScreenshot` is graphics-thread-expensive (throttle, key-size,
jpg; a scene identical in preview/program may return the preview variant — issue
#1257 **[2nd]**). No native transform easing. UUID addressing (`sceneUuid` etc.)
was added **after** 5.0 (~5.1) — **address by name** for widest compat and check
`GetVersion.availableRequests` before wiring a maybe-absent request. Preview
requests error if Studio Mode is off — gate them. **[V-proto]**

---

## 3. Proposed architecture — the two-layer engine

Grounded in the bible: **§5.3** salvage-as-a-layer (don't rewrite), **§5.1**
convergence (bespoke & generic call the same functions), **§5.4** types-as-
contracts (typed settings), **§5.5** one-responsibility-per-file, **§2** SSOT.

```
                    ┌─────────────────────────────────────────────┐
 Layer 2 (PRESET)   │  Control Room bespoke keys (existing)        │  ← Ryan's muscle memory
                    │  ShowFlow · CameraPicker · MeetingMode ·     │    preserved; each becomes a
                    │  Mark · (bespoke scene keys during transition)│    thin caller of Layer 1 fns
                    └───────────────────────┬─────────────────────┘
                                            │ calls the same engine functions (§5.1)
                    ┌───────────────────────▼─────────────────────┐
 Layer 1 (GENERIC)  │  Reusable configurable actions, each w/ a PI │
                    │  Scene · SourceToggle · Audio · Transition · │  ← the "product": every action
                    │  Output · Replay · Filter · Status · Macro · │    is dropdown-configured, typed
                    │  SceneThumbnail · SourceAnimation            │    settings, state feedback
                    ├──────────────────────────────────────────────┤
                    │  ObsAction<S> base class  ·  datasource plumbing│ ← reuse SSOT for actions:
                    │  (connected/disconnected/error key states,     │   event wiring, error faces,
                    │   typed settings, GetScenes/Inputs/Items feed)  │   PI dropdown population
                    └───────────────────────┬──────────────────────┘
                    ┌───────────────────────▼─────────────────────┐
 Layer 0 (INFRA)    │  obs-connection.ts (generalize: config from   │  ← EXISTING assets, kept.
                    │   global settings ▸ fallback to local OBS cfg)│    Add per-connection config;
                    │  key-face.ts (rendering SSOT, add thumbnail)  │    keep auto-detect default.
                    └──────────────────────────────────────────────┘
```

**Key architectural moves:**

1. **`ObsAction<S>` base class** (new, `src/obs-action.ts`) — the reuse SSOT.
   Extends `SingletonAction<S>`; standardizes: subscribe/unsubscribe to `obs`
   events, `connected/disconnected/error` key faces, a `render(action)` template,
   typed settings access, and the "resolve name→id, cache, follow event" pattern.
   Every generic action extends this instead of copy-pasting the constructor
   wiring that all 10 current actions repeat.

2. **Datasource plumbing** (new, `src/datasource.ts`) — one `onSendToPlugin`
   router that answers `getScenes`/`getInputs`/`getSceneItems`/`getFilters`/
   `getTransitions`/`getAudioInputs` from live OBS, formatted as
   `sdpi-components` `DataSourcePayload`. Every PI reuses it.

3. **Connection config becomes settable** — `obs-connection` reads **global
   settings first** (host/port/password from a config PI), **falls back to the
   local OBS config file** (today's zero-config behavior). This is the single
   change that makes the plugin distributable *without* regressing Ryan's setup.

4. **Generic Scene action replaces 8 classes** — one `Scene` action, scene picked
   from a live dropdown, `program`/`preview` mode, on-air state feedback. The 8
   bespoke scene classes are retired **one at a time** (§5.3), not in a big bang;
   Control Room keys can migrate to configured `Scene` instances or a bundled
   profile.

5. **Preset layer keeps bespoke keys** — `ShowFlow` etc. stay as their own
   actions but their internals call Layer-1 functions (e.g. a shared
   `switchScene(name)`), so there's one code path (§5.1).

6. **Import/export presets** — since all config lives in typed settings, an
   export is "serialize this action's settings to JSON"; import is the reverse.
   Source-animation presets (BarRaider-style) ride the same mechanism.

---

## 4. Prioritized roadmap

Each feature ships with testing instructions and is a small, reversible commit
(bible §3.1). Nothing here deletes working bespoke keys until its generic
replacement is finger-verified.

### MVP — the reusable-action + property-inspector foundation
*Goal: prove the whole architecture end-to-end with the smallest real slice.*

- **M1 — Connection config PI + settable connection.** A config PI (host/port/
  password) writing global settings; `obs-connection` reads global-first,
  local-config-fallback. On-key diagnostics for disconnected/auth-failed states.
  *Test: wrong password → keys show a clear error face; clear it → reconnect within one retry cycle.*
- **M2 — `ObsAction<S>` base class + datasource router.** Refactor 1 existing
  action (`Record`) onto the base to prove parity; stand up the `getScenes`/
  `getInputs` datasource. *Test: Record still behaves identically; a throwaway PI dropdown lists live scenes.*
- **M3 — Generic `Scene` action w/ full PI.** Live scene dropdown, program/preview
  toggle, on-air highlight via `CurrentProgramSceneChanged`. *Test: drop 3 Scene keys, configure each to a different scene, on-air key lights up as you cut; add a 4th scene in OBS and it appears in the dropdown with no rebuild.*
- **M4 — Generic `SourceToggle` (visibility).** Scene+source dropdowns →
  `SetSceneItemEnabled`, state from `SceneItemEnableStateChanged`. *Test: toggle a source hidden/shown; key state tracks OBS even when toggled in OBS directly.*

**MVP exit criteria:** one action configured by dropdown, persisted in settings,
with live state feedback and honest error faces — i.e. the reusability + PI +
status-feedback + error-handling requirements demonstrably met.

### v2 — creator-workflow breadth on the same rails
- **Studio Mode / preview-live awareness**: `StudioMode` toggle + `Preview` push
  action; Scene action gains preview-target mode. (Studio-mode gating per §2C.)
- **Generic `Audio`**: mute (toggle/PTT/PTM modes) + volume set/step, **dial
  support** with `setFeedback`, VU option via `InputVolumeMeters`.
- **Generic `Output`**: record/stream/virtual-cam/**record-pause** as one
  configurable toggle with `outputState` STARTING/STOPPING pending faces
  (generalizes existing Record/Stream/Pause).
- **`Replay`**: save + long-press-arm buffer (the pro differentiator).
- **`Transition`**: set transition + duration; trigger studio transition.
- **`Filter` toggle.**
- **Import/export presets** (per-action settings ⇄ JSON).
- **Migrate bespoke scene keys → configured `Scene`/bundled profile**; retire
  `scene-keys.ts` subclasses.

### Stretch — the "paid-grade" tier
- **Scene thumbnail on key** (`GetSourceScreenshot`, throttled, preview/live
  border) — the headline differentiator.
- **Source Animation** (record start/end transform → client-side stepped tween,
  or Move-plugin delegate) **with import/export**.
- **Macro** action (`callBatch` + `Sleep`) — free alternative to Aitum's paywalled
  automation.
- **Health telemetry** (dropped-frames alarm w/ color threshold, CPU% via
  `GetStats`) — generalizes existing `Status`.
- **Scene-collection / profile switch.** **`CallVendorRequest`** bridge for
  Advanced Scene Switcher / Move.
- **Cross-platform (Windows)** — only if the fork is "distributable product":
  cold-start, path, and CoreGraphics code all need per-OS branches.

### Explicitly out of scope (unless you say otherwise)
Twitch/chat integration (BarRaider-specific), multi-PC remote control, non-OBS
device tiles (HOME shell lives in the profile/README plan, not this plugin).

---

## 5. Testing strategy (bible §6.4 — integration > mocked units)

- **Ground truth is a running OBS + the physical deck.** The recurring note in
  the README is "finger-verification still pending" — that's the test that
  matters. Each feature's testing instructions drive the real deck against real
  OBS.
- **`streamdeck dev`** for Node-debugger + PI remote-debug (`localhost:23654`);
  `streamDeck.logger` scoped logs in `logs/`.
- **A thin harness** (`scripts/` already talks obs-websocket) can assert an action
  reached the right OBS state (e.g. after a Scene press, `GetCurrentProgramScene`
  matches) — one real end-to-end check per action beats mocked units.
- **`GetVersion.availableRequests`** guard so a key never fires a request the
  connected OBS build lacks.

---

## 6. Risks & mitigations

- **Regressing the locked face grammar / finger-feel** → bespoke keys stay until
  their generic replacement is finger-verified; `key-face.ts` remains the sole
  generator.
- **Screenshot cost** (thumbnails) → throttle to key-size/jpg/1–4 Hz, visible
  keys only, behind a per-action opt-in.
- **OBS version drift** (UUID fields, multi-canvas) → address by **name**, probe
  `availableRequests`.
- **Scope creep toward BarRaider parity** → the roadmap is staged; MVP proves the
  engine before breadth.

---

## 7. Open decisions for you (the fork)

1. **Product vs instrument** *(gates cross-platform + connection-config scope)* —
   distributable Marketplace product, or configurable personal instrument?
   *Recommendation: **hybrid** — build the generic engine + connection-config so
   it's distributable-ready, but don't invest in Windows/Marketplace polish until
   the engine earns it. Costs nothing extra now, keeps the option open.*
2. **MVP scope** — is M1–M4 (config PI + base class + generic Scene + SourceToggle)
   the right first slice, or do you want a specific v2 feature (e.g. Replay,
   thumbnails) pulled forward?
3. **Bespoke migration pace** — retire the 8 hardcoded scene classes as soon as
   generic `Scene` is verified, or keep both indefinitely?
4. **Claim the Marketplace maker handle + UUID namespace now?** (free, first-come.)
```
