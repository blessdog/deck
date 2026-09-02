# Deck Mono Project Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every key on the Stream Deck does one visible thing; the four dead behaviours are fixed; three new keys land; the repo becomes `deck` with sections.

**Architecture:** The layout is data (`scripts/deck-layout.mjs`) written onto the physical decks by `build-profile.mjs` and policed by `check-deck.mjs`. Our plugin owns keys whose face must follow OBS state; native Stream Deck actions (Hotkey) and the official Elgato OBS plugin (dials) are placed by the same layout file. OBS scenes are built by `add-look.mjs` and verified by `snapshot.mjs`.

**Tech Stack:** Node 24 (`/opt/homebrew/opt/node@24/bin`), `@elgato/streamdeck` 2.x, `obs-websocket-js` 5, Rollup + TypeScript, OBS 32.2.2, Stream Deck app 7.4.2.

## Global Constraints

- Plugin UUID `com.blessdog.obs-control-room` never changes.
- No ingest/Resolve/media-studio call from this repo (`knowledge/the-deck-ends-at-the-mp4.md`).
- Verification is Ryan pressing the key while a snapshot is taken through OBS. A log line is not verification.
- Superseded code moves to `archive/` with a header, never deleted.
- Every command that touches Stream Deck profiles quits the app first (`build-profile.mjs` does).
- `PATH="/opt/homebrew/opt/node@24/bin:$PATH"` before every `node`/`npm`.
- Commits: small, search-bait subject, no AI attribution, end with `Claude-Session: https://claude.ai/code/session_017ochbmpwLXUcxBgAbaot2f`.
- Repo root for every command: `/Users/SSDrive/projects/mediaStudio/obs-control-room` (renamed to `deck` in Task 12).

## File map

| File | Responsibility |
|---|---|
| `scripts/add-look.mjs` | scene builders (`float`, `screens`, `cutout` new) |
| `scripts/deck-layout.mjs` | ACTIONS (ours), NATIVE (Stream Deck Hotkey), ENCODERS (official OBS dials), VERIFY sentences, grids |
| `scripts/build-profile.mjs` | writes ours + native + encoder keys |
| `scripts/check-deck.mjs` | tripwire: orphans, unplaced, missing VERIFY |
| `scripts/harvest-key.mjs` (new) | prints a placed key's JSON from the live profile so its settings can be committed into the layout |
| `plugin/src/actions/reveal.ts`, `pause.ts`, `shot.ts` (new) | the three new keys |
| `plugin/src/plugin.ts`, `plugin/…/manifest.json` | registration |
| `archive/zoom-in-obs/`, `archive/status-key/` | superseded, with headers |

---

### Task 1: Cutout — Background Removal on, chroma key off

**Files:**
- Modify: `scripts/add-look.mjs` (add `cutout` kind)
- Test: live OBS via `scripts/snapshot.mjs`

**Interfaces:**
- Produces: `node scripts/add-look.mjs cutout` — idempotent; configures the `Camera FX` filters.

- [ ] **Step 1: Write the failing check** — a transparent-pixel ratio on the Cam Cutout snapshot.

Create `scripts/check-cutout.mjs`:
```js
#!/usr/bin/env node
// Tripwire for the CUTOUT key: the Cam Cutout scene must have a real alpha
// hole where the room was. Ratio of transparent pixels is the countable line.
import { connect } from './lib/obs.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const obs = await connect();
const { imageData } = await obs.call('GetSourceScreenshot', { sourceName: 'Cam Cutout', imageFormat: 'png', imageWidth: 480 });
await obs.disconnect();
const out = process.argv[2] ?? 'evidence/cutout-check.png';
writeFileSync(out, Buffer.from(imageData.split(',')[1], 'base64'));
const ratio = parseFloat(execFileSync('/opt/homebrew/bin/magick', [out, '-format', '%[fx:1-mean.a]', 'info:']).toString());
console.log(`transparent ratio ${ratio.toFixed(3)} (${out})`);
if (ratio < 0.2) { console.error('✖ cutout is not cutting: <20% of the frame is transparent'); process.exit(1); }
console.log('✓ cutout has an alpha hole');
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `node scripts/check-cutout.mjs evidence/2026-09-02/cutout-before.png`
Expected: `✖ cutout is not cutting` (chroma key on a room leaves ~0 transparent).

- [ ] **Step 3: Add the `cutout` look to add-look.mjs**

In `scripts/add-look.mjs`, after the usage line add `cutout` to the usage string and dispatch: `else if (kind === 'cutout') await cutout();`. Add:

```js
/**
 * CUTOUT — make the background-removed camera actually remove the background.
 * Measured 2026-09-02: the Camera FX source had Background Removal disabled
 * and a green-screen Chroma Key enabled. There is no green screen; the key
 * punched holes in a house plant and left Ryan in the room. The remover is
 * royshil obs-backgroundremoval 1.1.13 (kind `background_removal`); on Apple
 * Silicon it runs on CoreML. Model is CHOSEN, not measured — Ryan's eyes decide
 * between rvm (quality) and mediapipe (speed) by snapshot.
 */
async function cutout() {
  const sourceName = 'Camera FX';
  const { filters } = await obs.call('GetSourceFilterList', { sourceName });
  for (const f of filters) {
    if (f.filterKind === 'chroma_key_filter_v2') {
      await obs.call('RemoveSourceFilter', { sourceName, filterName: f.filterName });
      console.log(`removed ${f.filterName} (no green screen here)`);
    }
  }
  const settings = {
    useGPU: 'coreml',
    model_select: 'models/rvm_mobilenetv3_fp32.onnx',
    threshold: 0.5,
    contour_filter: 0.05,
    smooth_contour: 0.5,
    feather: 0.05,
    temporal_smooth_factor: 0.85,
    mask_every_x_frames: 1,
    enable_threshold: true,
    enable_image_similarity: false,
    numThreads: 1,
  };
  const existing = filters.find((f) => f.filterKind === 'background_removal');
  if (existing) {
    await obs.call('SetSourceFilterSettings', { sourceName, filterName: existing.filterName, filterSettings: settings });
    await obs.call('SetSourceFilterEnabled', { sourceName, filterName: existing.filterName, filterEnabled: true });
  } else {
    await obs.call('CreateSourceFilter', { sourceName, filterName: 'Background Removal', filterKind: 'background_removal', filterSettings: settings });
  }
  console.log(`Camera FX: Background Removal ON (coreml, rvm).`);
}
```

- [ ] **Step 4: Run the look, then the check**

Run: `node scripts/add-look.mjs cutout && node scripts/check-cutout.mjs evidence/2026-09-02/cutout-after.png && open evidence/2026-09-02/cutout-after.png`
Expected: `✓ cutout has an alpha hole`. If the ratio is still low with nobody in frame, that is correct (whole frame transparent = ratio ≈ 1). Ryan sits in frame for the verdict.

- [ ] **Step 5: Commit**

```bash
git add scripts/add-look.mjs scripts/check-cutout.mjs evidence/2026-09-02/cutout-*.png
git commit -m "fix: CUTOUT key — Background Removal on CoreML, chroma key removed (no green screen)"
```

---

### Task 2: Me + Float — screens fitter must not flatten the float card

**Files:**
- Modify: `scripts/add-look.mjs:71-114` (`fitScreens`)
- Test: live OBS, transform read-back

- [ ] **Step 1: Write the failing check**

Create `scripts/check-float.mjs`:
```js
#!/usr/bin/env node
// The Display item in "Me + Float" must be a CARD, not the full frame.
import { connect } from './lib/obs.mjs';
const obs = await connect();
const { sceneItems } = await obs.call('GetSceneItemList', { sceneName: 'Me + Float' });
await obs.disconnect();
const d = sceneItems.find((i) => i.sourceName === 'Display');
const cam = sceneItems.find((i) => i.sourceName === 'Camera');
const t = d?.sceneItemTransform;
const isCard = t && t.boundsWidth < 1200 && t.positionX > 600;
const camUnder = cam && d && cam.sceneItemIndex < d.sceneItemIndex;
console.log(`Display bounds ${t?.boundsWidth}x${t?.boundsHeight} at ${t?.positionX},${t?.positionY}; camera below display: ${camUnder}`);
if (!isCard || !camUnder) { console.error('✖ Me + Float is flattened — Display is full-frame or camera is on top'); process.exit(1); }
console.log('✓ Me + Float is a card over the camera');
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `node scripts/check-float.mjs` → `✖ Me + Float is flattened`.

- [ ] **Step 3: Make `fitScreens` crop-only for non-full-frame items**

Replace the `SetSceneItemTransform` call inside `fitScreens` with:
```js
      // Only re-fit items that are ALREADY the full frame. A Display placed as
      // a card (Me + Float) keeps its bounds and only gains the crop —
      // 2026-09-02: this loop flattened the float card to full frame and the
      // camera underneath vanished.
      const isFullFrame = Math.round(t.boundsWidth) >= W && Math.round(t.boundsHeight) >= H;
      const transform = isFullFrame
        ? { cropTop, cropBottom, cropLeft, cropRight, positionX: 0, positionY: 0, alignment: 5,
            boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsAlignment: 0, boundsWidth: W, boundsHeight: H }
        : { cropTop, cropBottom, cropLeft, cropRight };
      await obs.call('SetSceneItemTransform', { sceneName, sceneItemId: it.sceneItemId, sceneItemTransform: transform });
```

- [ ] **Step 4: Rebuild the float scene and re-run both looks**

Run: `node scripts/add-look.mjs float --replace && node scripts/add-look.mjs screens && node scripts/check-float.mjs && node scripts/snapshot.mjs "Me + Float" evidence/2026-09-02/mefloat-after.png && open evidence/2026-09-02/mefloat-after.png`
Expected: `✓ Me + Float is a card over the camera`, picture shows camera full-bleed with the share as a card lower-right.

- [ ] **Step 5: Commit**

```bash
git add scripts/add-look.mjs scripts/check-float.mjs evidence/2026-09-02/mefloat-after.png
git commit -m "fix: ME+FLOAT key — screens fitter no longer flattens the float card to full frame"
```

---

### Task 3: Native keys in the layout (ZOOM IN / ZOOM OUT via macOS zoom)

**Files:**
- Modify: `scripts/deck-layout.mjs`, `scripts/build-profile.mjs`, `scripts/check-deck.mjs`
- Archive: `vendor/obs-zoom-to-mouse.lua`, `plugin/src/actions/zoom.ts`, `scripts/install-zoom.mjs`, `scripts/verify-zoom.mjs` → `archive/zoom-in-obs/`
- Modify: `plugin/src/plugin.ts`, `plugin/com.blessdog.obs-control-room.sdPlugin/manifest.json` (remove `zoom` action)

**Interfaces:**
- Produces: `NATIVE` export in deck-layout: `{ [short]: { uuid, name, settings, title } }`; `placements()` unchanged; `isNative(short)` helper.

- [ ] **Step 1: Failing check** — `check-deck.mjs` must know native keys. Add `zoomIn`/`zoomOut` to the XL grid first (row 3 col 2 → `zoomIn`; row 1 col 2 → `zoomOut`), run `node scripts/check-deck.mjs`.
Expected: crashes on `ACTIONS[short]` undefined, because the layout only knows plugin actions.

- [ ] **Step 2: Add NATIVE to deck-layout.mjs**

```js
/**
 * Native Stream Deck actions we place. The Hotkey settings shape was harvested
 * from a hand-placed key on 2026-09-02 (scripts/harvest-key.mjs). Modifier
 * bitmask: Shift 1 · Ctrl 2 · Option 4 · Cmd 8. NativeCode is the macOS
 * virtual keycode (= is 24, - is 27, 8 is 28).
 *
 * ZOOM drives macOS Accessibility Zoom (knowledge/zoom-is-native-macos-zoom):
 * Ryan zooms the screen he is looking at and OBS records the composite.
 */
const hotkey = (nativeCode, ascii, { cmd = false, ctrl = false, option = false, shift = false } = {}) => ({
	Coalesce: true,
	Hotkeys: [
		{ KeyCmd: cmd, KeyCtrl: ctrl, KeyOption: option, KeyShift: shift,
		  KeyModifiers: (shift ? 1 : 0) + (ctrl ? 2 : 0) + (option ? 4 : 0) + (cmd ? 8 : 0),
		  NativeCode: nativeCode, QTKeyCode: ascii, VKeyCode: nativeCode },
		...Array(3).fill({ KeyCmd: false, KeyCtrl: false, KeyOption: false, KeyShift: false, KeyModifiers: 0, NativeCode: -1, QTKeyCode: 33554431, VKeyCode: -1 }),
	],
});
export const NATIVE = {
	zoomIn: { uuid: "com.elgato.streamdeck.system.hotkey", name: "Hotkey", title: "ZOOM\n+", settings: hotkey(24, 61, { option: true, cmd: true }) },
	zoomOut: { uuid: "com.elgato.streamdeck.system.hotkey", name: "Hotkey", title: "ZOOM\n−", settings: hotkey(27, 45, { option: true, cmd: true }) },
};
export const isNative = (short) => short in NATIVE;
```
Remove `zoom` from `ACTIONS`. Update `uuidOf`/`nameOf`:
```js
export const uuidOf = (short) => (isNative(short) ? NATIVE[short].uuid : `${PLUGIN}.${ACTIONS[short][0]}`);
export const nameOf = (short) => (isNative(short) ? NATIVE[short].name : ACTIONS[short][1]);
```

- [ ] **Step 3: Teach build-profile.mjs to write native keys**

In the placements loop, before `const uuid = uuidOf(short);` handle native:
```js
		if (isNative(short)) {
			const n = NATIVE[short];
			const prior = before[coord];
			next[coord] = {
				ActionID: prior?.UUID === n.uuid ? prior.ActionID : randomUUID(),
				LinkedTitle: false, Name: n.name, Resources: null,
				Settings: n.settings, State: 0,
				States: [{ FontFamily: "", FontSize: 11, FontStyle: "Bold", FontUnderline: false, Image: "", OutlineThickness: 2, ShowTitle: true, Title: n.title, TitleAlignment: "middle", TitleColor: "#ffffff" }],
				UUID: n.uuid,
			};
			continue;
		}
```
Import `NATIVE, isNative` from `./deck-layout.mjs`. Also change the "keep every key that isn't ours" filter so that native keys **we** place are replaced rather than kept: drop keys at coords the layout places, i.e. compute `const placedCoords = new Set(placements(layout).map((p) => p.coord));` and keep `act` only if `!act?.UUID?.startsWith(PLUGIN) && !placedCoords.has(coord)`.

- [ ] **Step 4: Teach check-deck.mjs** — where it iterates placements/shipped, skip native shorts for the "shipped" test but require they have a `uuid`. Simplest: in the orphan loop `if (!uuid?.startsWith(PLUGIN)) continue;` already ignores native keys on the deck. Add after building `unplaced`: nothing else needed. Run `node scripts/check-deck.mjs` → `✓`.

- [ ] **Step 5: Archive the OBS-side zoom**

```bash
mkdir -p archive/zoom-in-obs
git mv vendor/obs-zoom-to-mouse.lua archive/zoom-in-obs/
git mv plugin/src/actions/zoom.ts archive/zoom-in-obs/zoom.ts
git mv scripts/install-zoom.mjs scripts/verify-zoom.mjs archive/zoom-in-obs/
```
Write `archive/zoom-in-obs/README.md`:
```
# zoom-in-obs — superseded 2026-09-02
What it was: obs-zoom-to-mouse Lua (patched for OBS 32) driven by the ZOOM key over the websocket.
What beat it: macOS Accessibility Zoom sent as a hotkey (knowledge/zoom-is-native-macos-zoom).
Measured reason: Ryan cannot see the framing an OBS-only zoom produces because his eyes are on the real screen. It also died silently twice from path moves (2026-08-18, 2026-09-02).
Re-run when: OBS Display Capture stops including the system zoom (Apple behaviour) — then this is the fallback.
```
Remove `import { Zoom }` and `registerAction(new Zoom())` from `plugin/src/plugin.ts`; remove the `zoom` action object from the manifest.

- [ ] **Step 6: Make sure macOS zoom shortcuts are on and panning follows**

```bash
defaults write com.apple.universalaccess closeViewHotkeysEnabled -bool true
defaults write com.apple.universalaccess closeViewScrollWheelToggle -bool true
```
Ryan confirms "Use keyboard shortcuts to zoom" is on in System Settings → Accessibility → Zoom (the pane must see it once).

- [ ] **Step 7: Build and verify**

Run: `cd plugin && npm run build && cd .. && node scripts/check-deck.mjs && node scripts/build-profile.mjs && npx --prefix plugin streamdeck restart com.blessdog.obs-control-room`
Expected: check green; XL page 1 shows ZOOM + and ZOOM −. **Ryan presses ZOOM + with the mouse on the left monitor**; run `node scripts/snapshot.mjs "Screen L" evidence/2026-09-02/zoom-native-L.png && open evidence/2026-09-02/zoom-native-L.png`. The picture is zoomed → law verified. Not zoomed → write `kind: refuted` for capture and restore from archive.

- [ ] **Step 8: Commit**

```bash
git add -A scripts plugin/src plugin/com.blessdog.obs-control-room.sdPlugin/manifest.json archive evidence/2026-09-02
git commit -m "deck: ZOOM is macOS Accessibility Zoom on two native Hotkey keys; OBS Lua zoom archived"
```

---

### Task 4: VERIFY sentences — the tripwire for keys that do nothing

**Files:**
- Modify: `scripts/deck-layout.mjs`, `scripts/check-deck.mjs`

- [ ] **Step 1: Failing check** — add to check-deck.mjs after `unplaced`:
```js
import { VERIFY } from "./deck-layout.mjs";
const unverified = [...Object.keys(ACTIONS), ...Object.keys(NATIVE)].filter((s) => !VERIFY[s]);
if (unverified.length) { console.error(`\n✖ ${unverified.length} KEY(S) WITH NO VERIFY SENTENCE — a key nobody can test is a key nobody knows is dead:`); for (const s of unverified) console.error(`    ${s}`); }
```
and include `unverified.length` in the exit condition. Import `ACTIONS, NATIVE` too. Run → fails listing every key.

- [ ] **Step 2: Add VERIFY to deck-layout.mjs**
```js
/** How a human proves each key works. One sentence, an action and what to look at. */
export const VERIFY = {
	record: "Press; ~/Movies gains a playable MP4 when pressed again.",
	mark: "Press twice while recording; ffprobe shows two chapters.",
	mute: "Press; OBS mixer shows Mic muted and the key turns red.",
	camera: "Press; the Cam scene switches iPhone ↔ FaceTime.",
	meeting: "Press; OBS Virtual Camera appears in a Zoom/Meet camera list.",
	soon: "Press; program shows Starting Soon and the key lights.",
	ending: "Press; program shows Ending.",
	brb: "Press; program shows BRB.",
	float: "Press; full-bleed camera with the share as a card lower-right.",
	screenLeft: "Press; program shows the LEFT monitor with real windows.",
	screenRight: "Press; program shows the RIGHT monitor with real windows.",
	screenCam: "Press; screen with camera bubble bottom-left.",
	cam: "Press; full camera.",
	cutout: "Press; Ryan on a transparent/lava background, no room.",
	lava: "Press; lava lamp behind the cutout.",
	rectumLeft: "Press, press again; rectum library gains a clip of the left monitor.",
	rectumRight: "Press, press again; rectum library gains a clip of the right monitor.",
	rectumCrop: "Press after a rectum recording; the crop proposal opens.",
	rectumGrab: "Press with a video URL in the front tab; the file lands in the clip library.",
	zoomIn: "Press with the mouse on the left monitor; the screen AND the Screen L snapshot zoom.",
	zoomOut: "Press; zoom steps back out.",
};
```
Run `node scripts/check-deck.mjs` → green.

- [ ] **Step 3: Commit** — `git commit -am "check-deck: every key must carry a VERIFY sentence"`

---

### Task 5: Remove the Status key

**Files:**
- Archive: `plugin/src/actions/status.ts` → `archive/status-key/status.ts` with README
- Modify: `plugin/src/plugin.ts`, manifest (remove `status`), `deck-layout.mjs` (remove from ACTIONS, XL, SDPLUS; SD+ 0,0 becomes `screenCam`)

- [ ] **Step 1:** `git mv plugin/src/actions/status.ts archive/status-key/` and write `archive/status-key/README.md`: "Removed 2026-09-02 by law `recording-friction-is-the-product`: every scene key already cold-starts OBS; a READY tile duplicated RECORD's state. Re-run when: Ryan streams (LIVE state matters)."
- [ ] **Step 2:** Remove import/registration from `plugin.ts`, the `status` manifest action, the `status` ACTIONS entry, replace `"status"` in `XL` row 0 col 0 with `null` and in `SDPLUS` row 0 col 0 with `"screenCam"`; SDPLUS row 1 col 3 becomes `"reveal"` in Task 6 (leave `"cutout"` for now).
- [ ] **Step 3:** `cd plugin && npm run build && cd .. && node scripts/check-deck.mjs` → green (status gone from both sides).
- [ ] **Step 4:** Commit: `git commit -am "deck: Status/READY key removed — every scene key already cold-starts OBS"`

---

### Task 6: REVEAL key — Finder on the newest recording

**Files:**
- Create: `plugin/src/actions/reveal.ts`
- Modify: `plugin/src/plugin.ts`, manifest, `deck-layout.mjs` (ACTIONS `reveal`, XL row 3 col 7, SDPLUS row 1 col 3, VERIFY)

- [ ] **Step 1: Failing check** — add `reveal: ["reveal", "Reveal Recording"]` to ACTIONS and place it; run `node scripts/check-deck.mjs` → `✖ layout references actions the plugin does not ship` (build-profile) / unplaced logic. Expected FAIL.

- [ ] **Step 2: Write the action**

`plugin/src/actions/reveal.ts`:
```ts
import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { execFile } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { obs } from "../obs-connection";
import { face, GLYPHS } from "../key-face";

/**
 * REVEAL — Finder with the newest recording selected, nothing more.
 * Law (knowledge/the-deck-ends-at-the-mp4): the deck never hands a file
 * downstream. Ryan cuts several snippets together, so the unit he drags from
 * is the folder, not one file. The directory is read from OBS itself when it
 * is up (SSOT), and falls back to ~/Movies when it is not.
 */
@action({ UUID: "com.blessdog.obs-control-room.reveal" })
export class Reveal extends SingletonAction {
	private readonly log = streamDeck.logger.createScope("reveal");

	override onWillAppear(_ev: WillAppearEvent): void {
		void this.render();
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		try {
			const dir = await this.recordDirectory();
			const newest = readdirSync(dir)
				.filter((f) => /\.(mp4|mkv|mov)$/i.test(f))
				.map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
				.sort((a, b) => b.t - a.t)[0];
			const target = newest ? join(dir, newest.f) : dir;
			await new Promise<void>((res, rej) => execFile("/usr/bin/open", newest ? ["-R", target] : [target], (e) => (e ? rej(e) : res())));
			this.log.info(`revealed ${target}`);
			await ev.action.showOk();
		} catch (err) {
			this.log.error(`reveal failed: ${err}`);
			await ev.action.showAlert();
		}
	}

	private async recordDirectory(): Promise<string> {
		if (obs.connected) {
			try {
				return (await obs.call("GetRecordDirectory")).recordDirectory;
			} catch { /* fall through */ }
		}
		return join(process.env.HOME ?? "", "Movies");
	}

	private async render(): Promise<void> {
		const uri = face({ state: "idle", tint: "bracket", glyph: GLYPHS.folder });
		for (const a of this.actions) void a.setImage(uri);
	}
}
```
Add a `folder` glyph to `GLYPHS` in `key-face.ts`:
```ts
	folder: "M24 40 h34 l10 10 h60 v54 H24 Z M24 58 h104",
```

- [ ] **Step 3: Register** — in `plugin.ts` add `import { Reveal } from "./actions/reveal";` and `streamDeck.actions.registerAction(new Reveal());`. Add to manifest `Actions`:
```json
{ "Name": "Reveal Recording", "UUID": "com.blessdog.obs-control-room.reveal", "Icon": "imgs/actions/mark/icon",
  "Tooltip": "Open Finder with the newest recording selected. The deck ends at the file.", "Controllers": ["Keypad"],
  "States": [{ "Image": "imgs/actions/mark/key", "ShowTitle": false }] }
```
Add `reveal: "Press after a recording; Finder opens with that MP4 selected."` to VERIFY.

- [ ] **Step 4: Build, place, verify** — `cd plugin && npm run build && cd .. && node scripts/check-deck.mjs && node scripts/build-profile.mjs && npx --prefix plugin streamdeck restart com.blessdog.obs-control-room`. Ryan presses REVEAL → Finder shows today's newest MP4 selected.

- [ ] **Step 5: Commit** — `git add -A plugin/src scripts plugin/com.blessdog.obs-control-room.sdPlugin/manifest.json && git commit -m "deck: REVEAL key — Finder on the newest recording; the deck ends at the MP4"`

---

### Task 7: PAUSE key

**Files:**
- Create: `plugin/src/actions/pause.ts`
- Modify: `plugin.ts`, manifest, `deck-layout.mjs` (ACTIONS `pause`, XL row 1 col 7, VERIFY)

- [ ] **Step 1: Failing check** — place `pause` in the layout, run `node scripts/check-deck.mjs` → FAIL (not shipped).

- [ ] **Step 2: Write the action**

```ts
import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obs } from "../obs-connection";
import { face, GLYPHS } from "../key-face";

/**
 * PAUSE — pause/resume the running recording. Dim when nothing is recording.
 * Never acts on remembered state: the press re-reads GetRecordStatus, the
 * face follows RecordStateChanged (OBS_WEBSOCKET_OUTPUT_PAUSED / RESUMED).
 */
@action({ UUID: "com.blessdog.obs-control-room.pause" })
export class Pause extends SingletonAction {
	private readonly log = streamDeck.logger.createScope("pause");
	private recording = false;
	private paused = false;

	constructor() {
		super();
		obs.on("connected", () => void this.refresh());
		obs.on("disconnected", () => { this.recording = false; this.paused = false; void this.render(); });
		obs.on("RecordStateChanged", ({ outputActive, outputState }) => {
			this.recording = outputActive;
			if (outputState === "OBS_WEBSOCKET_OUTPUT_PAUSED") this.paused = true;
			if (outputState === "OBS_WEBSOCKET_OUTPUT_RESUMED" || outputState === "OBS_WEBSOCKET_OUTPUT_STOPPED") this.paused = false;
			void this.render();
		});
	}

	override onWillAppear(_ev: WillAppearEvent): void { void this.refresh(); }

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		try {
			const s = await obs.call("GetRecordStatus");
			if (!s.outputActive) { await ev.action.showAlert(); return; }
			await obs.call("ToggleRecordPause");
			await ev.action.showOk();
		} catch (err) {
			this.log.error(`pause failed: ${err}`);
			await ev.action.showAlert();
		}
		void this.refresh();
	}

	private async refresh(): Promise<void> {
		if (obs.connected) {
			try {
				const s = await obs.call("GetRecordStatus");
				this.recording = s.outputActive; this.paused = s.outputPaused;
			} catch { /* keep last known */ }
		}
		void this.render();
	}

	private async render(): Promise<void> {
		const uri = face({
			state: !this.recording ? "offline" : this.paused ? "alert" : "idle",
			tint: "live", glyph: this.paused ? GLYPHS.play : GLYPHS.pause, sub: this.paused ? "paused" : undefined,
		});
		for (const a of this.actions) void a.setImage(uri);
	}
}
```
Register in `plugin.ts`; manifest entry `{ "Name": "Pause Recording", "UUID": "com.blessdog.obs-control-room.pause", ... same Icon/States shape as Reveal ... }`; VERIFY: `pause: "Press mid-recording, press again; the finished file plays through both halves."`

- [ ] **Step 3: Build, place, verify** — same build line as Task 6. Ryan: RECORD, PAUSE, PAUSE, RECORD → play the file in `~/Movies`.
- [ ] **Step 4: Commit** — `git commit -m "deck: PAUSE key — ToggleRecordPause, face follows OBS pause events"`

---

### Task 8: SHOT key — screenshot of program output

**Files:**
- Create: `plugin/src/actions/shot.ts`
- Modify: `plugin.ts`, manifest, `deck-layout.mjs` (ACTIONS `shot`, XL row 3 col 6, VERIFY)

- [ ] **Step 1: Failing check** — place `shot`, run check-deck → FAIL.
- [ ] **Step 2: Write the action**
```ts
import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { execFile } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { obs } from "../obs-connection";
import { face, GLYPHS } from "../key-face";

/** SHOT — a PNG of the program scene into ~/Movies/OBS Shots, then reveal it. */
@action({ UUID: "com.blessdog.obs-control-room.shot" })
export class Shot extends SingletonAction {
	private readonly log = streamDeck.logger.createScope("shot");

	constructor() {
		super();
		obs.on("connected", () => void this.render());
		obs.on("disconnected", () => void this.render());
	}
	override onWillAppear(_ev: WillAppearEvent): void { void this.render(); }

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		try {
			const dir = join((await obs.call("GetRecordDirectory")).recordDirectory, "OBS Shots");
			mkdirSync(dir, { recursive: true });
			const { currentProgramSceneName } = await obs.call("GetCurrentProgramScene");
			const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
			const imageFilePath = join(dir, `${stamp}.png`);
			await obs.call("SaveSourceScreenshot", { sourceName: currentProgramSceneName, imageFormat: "png", imageFilePath });
			execFile("/usr/bin/open", ["-R", imageFilePath]);
			this.log.info(`shot ${imageFilePath}`);
			await ev.action.showOk();
		} catch (err) {
			this.log.error(`shot failed: ${err}`);
			await ev.action.showAlert();
		}
	}

	private async render(): Promise<void> {
		const uri = face({ state: obs.connected ? "idle" : "offline", tint: "screen", glyph: GLYPHS.camera });
		for (const a of this.actions) void a.setImage(uri);
	}
}
```
Register; manifest entry "Screenshot"; VERIFY: `shot: "Press; Finder reveals a PNG of what was on program."`
- [ ] **Step 3: Build, place, verify** — Ryan presses SHOT; a PNG is revealed and opens.
- [ ] **Step 4: Commit** — `git commit -m "deck: SHOT key — program screenshot to ~/Movies/OBS Shots"`

---

### Task 9: Screen L wallpaper check (permission)

- [ ] **Step 1:** Ryan presses Screen L with windows open on the left monitor. If OBS shows wallpaper only: `open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"`, toggle OBS off → on, quit and relaunch OBS.
- [ ] **Step 2:** `node scripts/snapshot.mjs "Screen L" evidence/2026-09-02/screen-l-after.png && open evidence/2026-09-02/screen-l-after.png` → windows visible.
- [ ] **Step 3:** If it was stale, add one line to README's silent-failures table date column ("recurred 2026-09-02"). Commit.

---

### Task 10: Move transition between camera looks

- [ ] **Step 1:** `curl -L -o ~/Downloads/move-transition-3.2.1-macos-universal.pkg https://github.com/exeldro/obs-move-transition/releases/download/3.2.1/move-transition-3.2.1-macos-universal.pkg && open ~/Downloads/move-transition-3.2.1-macos-universal.pkg` — Ryan runs the installer (admin). Quit and relaunch OBS.
- [ ] **Step 2:** Verify it loaded: `node -e 'import("./scripts/lib/obs.mjs").then(async({connect})=>{const o=await connect();console.log((await o.call("GetSceneTransitionList")).transitions.map(t=>t.transitionKind));process.exit(0)})'` → includes `move_transition`.
- [ ] **Step 3:** Create `scripts/set-transition.mjs`:
```js
#!/usr/bin/env node
// Make Move the scene transition so camera looks slide instead of cut.
import { connect } from './lib/obs.mjs';
const obs = await connect();
const { transitions } = await obs.call('GetSceneTransitionList');
if (!transitions.some((t) => t.transitionKind === 'move_transition')) {
  await obs.call('CreateSceneTransition', { transitionName: 'Move', transitionKind: 'move_transition' }).catch(() => {});
}
await obs.call('SetCurrentSceneTransition', { transitionName: 'Move' });
await obs.call('SetCurrentSceneTransitionDuration', { transitionDuration: 350 });
console.log('transition: Move, 350 ms');
await obs.disconnect();
```
Run it. Ryan presses CAM then ME+FLOAT: the camera slides. Commit.

---

### Task 11: SD+ dials — official OBS plugin Audio Mixer Volume

- [ ] **Step 1: harvest tool** — create `scripts/harvest-key.mjs`:
```js
#!/usr/bin/env node
// Print the JSON of every key/dial on the default profiles that is NOT ours,
// so a hand-placed key's settings can be copied into deck-layout.mjs once.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
const PROFILES = join(homedir(), "Library/Application Support/com.elgato.StreamDeck/ProfilesV3");
const want = process.argv[2] ?? "";
for (const b of readdirSync(PROFILES).filter((d) => d.endsWith(".sdProfile"))) {
  const top = JSON.parse(readFileSync(join(PROFILES, b, "manifest.json"), "utf8"));
  if (top.Name !== "Default Profile") continue;
  for (const p of readdirSync(join(PROFILES, b, "Profiles"))) {
    const page = JSON.parse(readFileSync(join(PROFILES, b, "Profiles", p, "manifest.json"), "utf8"));
    for (const c of page.Controllers ?? []) for (const [coord, a] of Object.entries(c.Actions ?? {}))
      if (a.UUID?.includes(want) && !a.UUID.startsWith("com.blessdog")) console.log(`${top.Device.Model} ${c.Type} ${coord}\n${JSON.stringify(a, null, 1)}\n`);
  }
}
```
- [ ] **Step 2:** In the Stream Deck app, drag **OBS Studio → Audio Mixer Volume** onto SD+ dial 1, choose source `Mic`. Run `node scripts/harvest-key.mjs obsstudio` and copy the JSON into `deck-layout.mjs` as:
```js
export const ENCODERS = { "20GBD9901": { "0,0": { ...harvested, source: "Mic" }, "1,0": { ...same with SP-404 }, "2,0": { ...App Audio } } };
```
(replace the source field name with whatever the harvested Settings actually calls it).
- [ ] **Step 3:** In `build-profile.mjs`, after writing the keypad, write `page.Controllers.find(c => c.Type === "Encoder").Actions = { ...existing, ...ENCODERS[dev.model] }` for page 1 of the SD+.
- [ ] **Step 4:** `node scripts/build-profile.mjs`; Ryan turns dial 1 → OBS Mic fader moves. Commit: `deck: SD+ dials drive Mic / SP-404 / App Audio via the official OBS plugin`.

---

### Task 12: Rename to `deck`, section the repo, clean the workspace

- [ ] **Step 1:** `gh repo rename deck --repo blessdog/obs-control-room --yes && cd .. && mv obs-control-room deck && cd deck && git remote set-url origin https://github.com/blessdog/deck.git`
- [ ] **Step 2:** Sections: `git mv scripts/add-look.mjs scripts/setup-scenes.mjs scripts/set-display.mjs scripts/set-record-quality.mjs scripts/set-stream-key.mjs scripts/setup-audio.mjs scripts/snapshot.mjs scripts/cold-start.mjs scripts/set-transition.mjs scripts/check-cutout.mjs scripts/check-float.mjs obs/` and `git mv scripts/lib obs/lib`; `git mv scripts/grab.mjs rectum/`; `mkdir ableton && echo "Reserved. See knowledge/sp-404-sound-library-on-the-deck-and-ryan-s-own-.md" > ableton/README.md`. Fix every import path (`grep -rn "scripts/lib\|./lib/obs" scripts obs rectum plugin/src FINISH-DECK.command cold-start.command "OBS Cold Start.app"`), and the rectum.ts/grab paths that name `obs-control-room` (`grep -rn "obs-control-room" --include=*.ts --include=*.mjs --include=*.command .`).
- [ ] **Step 3:** `rmdir ../streamer ../OBS`; edit `../README.md` row to `deck/`. Update `CLAUDE.md` and `README.md` here for the new name and sections.
- [ ] **Step 4:** Rebuild plugin (`cd plugin && npm run build`), `node scripts/check-deck.mjs`, restart plugin, Ryan presses RECORD and GRAB — both still work after the move (this is the incident class that bit twice).
- [ ] **Step 5:** Commit: `git commit -m "rename: obs-control-room → deck; obs/ rectum/ ableton/ sections; empty streamer/ and OBS/ removed"` and `git push`.

---

### Task 13: README journey entry

- [ ] **Step 1:** Append an era to `README.md` under "The journey": **Tried / Happened / Mechanism / Verdict** for the three dead keys, the zoom decision, and the mono-project rename, with `evidence/2026-09-02/dead-keys-contact-sheet.png` and the zoom snapshot inline.
- [ ] **Step 2:** Update the deck grid in README to key set v2. Commit: `README journey: the deck audit — three dead keys, zoom goes native, one repo`.
