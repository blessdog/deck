# OBS Control Room

One-button screen shares and streaming: Stream Deck → OBS, with a scripted
scene collection, a cold-start launcher, and a custom Stream Deck plugin.
Everything the deck shows is derived from real state — OBS's own events,
CoreGraphics' actual monitor arrangement — because a key face that lies is
worse than no key at all.

## The journey

**Companion died first.** The obvious path was Bitfocus Companion, the
standard deck→OBS bridge. It ended as a half-blank XL profile that
became THE blocker — a config surface fighting the deck instead of
driving it. Retired entirely; replaced with a bespoke Elgato SDK v2
plugin where **the layout is data** (`scripts/deck-layout.mjs`), the
Stream Deck app is never hand-edited, and a tripwire script fails the
build if any key points at a missing action.

**The faces never lie.** Five silent failures taught the doctrine:
verify by exercising, never by observing. The mute key follows OBS's
own mute event rather than remembering what it pressed; the Status key
polls real stream state; screen keys draw the actual monitor
arrangement from CoreGraphics so a third monitor changes the picture
instead of making a label wrong.

**Keys are born from incidents.** Camera Picker exists because a
frozen Continuity-Camera session turned "switch cameras" into a
detour mid-recording — now it's one press. The end-show crash (OBS
threw when the stream died during the Ending hold) hardened StopStream
into stop-only-if-still-active. Mark exists so chapter markers land in
the recording file itself — no daemon, no database; ffprobe reads them
back at ingest.

**Compositions are checked by rendering.** `scripts/snapshot.mjs`
saves a PNG of a scene's actual program output — geometry is judged by
looking at pixels, never by reasoning about coordinates blind. (OBS
32.1.x returned transparent frames and briefly broke this; 32.2.1
fixed it.)

## Custom plugin (`plugin/`)

`com.blessdog.obs-control-room` — bespoke actions (Elgato SDK v2, Node 24),
in the Stream Deck app under category **"OBS Control Room"**:

| Action | Behavior |
|---|---|
| **Camera Picker** | Cycles the shared Camera source between physical cameras (iPhone Continuity ↔ built-in FaceTime HD). Face shows which is live; switches the cutout's Camera FX in lockstep. |
| **Status** | OFFLINE / READY / ⏺ REC / 🔴 LIVE with elapsed time + dropped-frame %. Press while offline = cold start. |
| **Meeting Mode** | *Screen + Cam* + OBS Virtual Camera on/off — then pick "OBS Virtual Camera" in Zoom/Meet. |
| **Record** | Toggle the OBS recording (cold-starts OBS if dead). Amber ⏺ + elapsed while rolling. Corpus doctrine: recordings pile up in `~/Movies`; processing is a separate, later act. |
| **Mute Mic** | Toggle the shared `Mic` input. Face follows OBS's own mute event (never lies): white open mic = hot, red slashed mic = muted. |
| **Mark** | While recording: drops an OBS **chapter marker** into the file itself, named with the record timecode. No daemon, no DB — ffprobe reads chapters back at ingest (verified: media-studio `scripts/verify_record_chapters.py`; OBS auto-adds a `Start` chapter at 0, ingest skips it). Dim + alert when not recording. |
| **Zoom to Cursor** | Punches the left-monitor capture in 2x on the mouse and follows it; long press toggles following. Drives `vendor/obs-zoom-to-mouse.lua` by name over the websocket (`TriggerHotkeyByName`) — no OS hotkey, no Accessibility permission. Checks the hotkey exists before firing, so an unloaded script alerts instead of doing nothing. |
| **Scene keys** | One key per scene, zero config; the on-air key lights up. Screen keys **draw the real monitor arrangement** (ordered by CoreGraphics x-origin) with the shared one filled, so a third monitor changes the picture instead of making "SCREEN L" lie. |

Build: `cd plugin && PATH="/opt/homebrew/opt/node@24/bin:$PATH" npm run build`,
then `npx streamdeck restart com.blessdog.obs-control-room` (or `npm run watch`).
The `.sdPlugin` dir is symlinked into the Stream Deck app by `npx streamdeck link`.
Plugin logs: `<plugins dir>/com.blessdog.obs-control-room.sdPlugin/logs/`.

Gotcha (Stream Deck app 7.4.2): first Node-plugin install fails silently because
the app never creates `~/Library/Application Support/com.elgato.StreamDeck/NodeJS/`
— `mkdir` it and restart the app.

## What's here

| Piece | What it does |
|---|---|
| `scripts/deck-layout.mjs` | **THE LAYOUT, as data.** Which action sits on which key, for XL and SD+. Edit here, never in the Stream Deck app. |
| `scripts/build-profile.mjs` | Writes `deck-layout.mjs` onto the physical decks. Quits the Stream Deck app first (it rewrites its config on exit) and preserves foreign keys. |
| `scripts/check-deck.mjs` | **The tripwire.** Fails if any key points at a missing action, or any shipped action sits on no key. Run after every build. |
| `scripts/add-look.mjs` | Additive scene builder: `brb` · `float` · `screens` · `character "<name>" <image>`. Does NOT wipe the collection. |
| `scripts/install-zoom.mjs` / `verify-zoom.mjs` | Register the zoom Lua with OBS (needs OBS quit) and ground-truth that it actually loaded. |
| `scripts/set-record-quality.mjs` | Recording bitrate (needs OBS quit). Currently 45 Mbps. |
| `FINISH-DECK.command` | Double-clickable: the steps that need OBS and the Stream Deck app quit, in order, with verification. |
| `scripts/setup-scenes.mjs` | Builds the **"Control Room"** collection from scratch. **Wipes and rebuilds** with `--force` — use `add-look.mjs` to add one scene. |
| `scripts/cold-start.mjs` | Launches OBS if needed, lands on *Starting Soon*. Flags: `--virtual-cam`, `--and-stream`. |
| `scripts/set-stream-key.mjs` | One-time: `node scripts/set-stream-key.mjs <KEY>` points OBS at YouTube RTMPS. Key lives in OBS config, never in this repo. |
| `OBS Cold Start.app` | Wrapper the Stream Deck 🚀 key opens (runs `cold-start.command`, logs to `logs/cold-start.log`). |
| `scripts/set-display.mjs` | Point the Screen capture at the built-in display (default) or `--external`. |
| `scripts/snapshot.mjs` | Save a PNG of a scene's program output. **Works again as of OBS 32.2.1** (it returned transparent frames on 32.1.x). This is how compositions get checked now — render it and look, don't reason about geometry blind. |
| `scripts/lib/obs.mjs` | Shared connect helper. Reads port/password from OBS's own websocket config (SSOT) and waits until OBS is actually ready (error-207 poll). Also `displayUUIDs()` via CoreGraphics, since OBS 32.1.x hangs on display enumeration. |

## Scenes

`Starting Soon` · `Screen L` · `Screen R` · `Cam` · `Cam Cutout` · `Lava Lounge` · `Screen + Cam` (camera bubble bottom-right) · **`Me + Float`** (full-bleed camera, share as a card lower-right) · **`BRB`** · `Ending`

One shared `Display` / `Camera` / `Mic` input reused across scenes — edit a device
once, every scene follows.

## State — 2026-08-01

**This project is THE Stream Deck surface.** The pipeline side lives in
`~/projects/media-studio` (see its `STATUS.md`). Bitfocus Companion is dead and
never comes back — its plugin is retired to `Plugins-retired-2026-08-01/`.

**The deck, as it sits (17 keys, `check-deck.mjs` green):**

```
 STATUS    ·      ·      ·    SOON    BRB   ENDING  RECORD     row 0 — far, rarely pressed
   ·       ·      ·      ·      ·       ·      ·       ·       row 1 — deliberate gutter
 LEFT    RIGHT  SCRN+ME  ·     CAM   CUTOUT ME+FLOAT LAVA      row 2 — what's on screen
 MARK    MUTE   ZOOM     ·   CAMERA  MEETING   ·    (nav)      row 3 — NEAREST the hand
```

Ordered by **reach, not category**. It used to be exactly backwards — every live
key on the far rows, the two rows nearest the hand empty.

**Face grammar** (measured off Elgato's shipped artwork, then given colour):
state is the WHOLE KEY's background · identity is the glyph · text only when
it's a number that changes. Families get hues — cyan screens, violet camera,
blue bracket, amber mark, green mic, red record — targeted by **luminance** so
every family reads with equal weight at the same state. `key-face.ts` is the
sole generator. **Dim means pressing does nothing; lit means pressing does
something** (which is why the OBS key is a lit power button when OBS is down).

**Doctrine earned the hard way on 2026-08-01 — five silent failures in one
session.** Dead deck keys, a camera pointed at a phone Ryan no longer owns, a
record key latched on, a screen capture returning only wallpaper, and a Lua
script that registered its hotkeys then died on every callback. **Every one
presented as working. Every machine-side check passed. All five were found by a
human looking at the actual thing.** Hence:

- Never act on cached state — re-read from OBS on use (`record.ts`, `camera-picker.ts`).
- A verifier must **exercise** the thing, not observe it. `verify-zoom.mjs`
  confirmed the hotkeys registered and still missed a script that was broken,
  because registration happens before the broken path runs.
- Render it and **look**. Screenshots work again on 32.2.1.

## Known-good numbers

- Canvas 1920x1080 @ 60fps · record h264 (Apple VT hardware) @ **45 Mbps**.
  Was 13.9 Mbps, which read as grain. NOT switched to HEVC despite it being
  ~40% more efficient: the media-studio pipeline is verified end-to-end on
  h264+AAC hybrid MP4, and changing codec means re-proving ingest.
- Displays: external at x=-1920 (1920x1080, native 16:9) · built-in at x=0
  (3456x2234, needs the aspect crop from `add-look.mjs screens`).
- Camera: `iPhone 14 pro Camera` via Continuity. **Center Stage runs off the
  ultra-wide lens and digitally crops**, which costs sharpness — that's the
  price of the follow-shot, not a bug, and it's why `Me + Float` avoids
  upscaling the camera.

## Next

1. **Finger-verify `Me + Float` with Ryan in frame** — does his face clear the
   floating card? Center Stage had him out of shot both attempts. Knobs:
   `camCentre` (40% across) and card width (52%) in `add-look.mjs`.
2. **Move plugin** (Exeldro, 2.49M downloads, 4.65★, macOS) — needs admin, a
   `.pkg`. Installs the animated push-aside between `Cam` and `Me + Float`;
   both scenes already share the same Camera source, which is what Move matches
   on, so no code changes needed.
3. **Character scenes** — `add-look.mjs character "<name>" <image>` works today;
   waiting on Ryan's background images. Each needs a key in `deck-layout.mjs`.
4. **The $0 iPhone multicam test** in media-studio `docs/IPHONE-MULTICAM.md` —
   written 2026-07-21, still never run. Camera A stays Continuity+Center Stage
   (the follow-shot); camera B becomes the locked-off wide, where losing Center
   Stage costs nothing.
5. Broadcast-tier features (dropped frames, replay, tally) stay **parked** —
   Ryan records, he doesn't stream.

## Stream Deck layout (MK.2, top two rows) — HISTORIC

*(First-generation layout from before the custom plugin; superseded by
the actions above + the HOME shell plan. Kept for reference.)*

| 🚀 Cold Start | 🚦 Starting Soon | 🖥 Screen | 🎥 Cam | 🖥🎥 Screen+Cam |
|---|---|---|---|---|
| **🔚 Ending** | **🔴 Stream** | **⏺ Record** | **📹 Virtual Cam** | **🔇 Mute Mic** |

- 🚀 = *System → Open* action pointing at `OBS Cold Start.app`.
- Everything else = official **OBS Studio** plugin actions (Scene, Stream, Record,
  Virtual Camera, Audio Mute → Mic). Free on [Elgato Marketplace](https://marketplace.elgato.com/product/obs-studio-35615969-830f-45c9-ba0a-1a295bba7fec).
- Going live is deliberately a second press (🔴) — cold start never auto-streams.

## One-time setup checklist

1. **macOS Screen Recording permission**: System Settings → Privacy & Security →
   Screen & System Audio Recording → enable **OBS**, then restart OBS.
   (Camera + mic were already granted.)
2. **YouTube live enablement** (~16 subs is fine — desktop encoder streaming has no
   subscriber minimum): YouTube Studio → Go Live → verify phone → wait ≤24 h.
   Then copy the stream key and run `node scripts/set-stream-key.mjs <KEY>`.
3. **Stream Deck**: the layout is written from the repo — edit
   `scripts/deck-layout.mjs`, then `node scripts/build-profile.mjs`. Never drag
   keys in the Stream Deck app; that's how the deck and the code drift apart.

## When something looks fine but isn't

Everything in this list presents as working. None of them throws an error, and
no log line reports any of them — each was found by a human looking at the
actual picture. Check here first.

| Symptom | Cause | Fix |
|---|---|---|
| **Screen share shows the desktop wallpaper — no windows, not even desktop icons** | macOS Screen Recording permission has gone stale. TCC stores the grant against the app's code signature, so an OBS update can leave the row reading "allowed" while ScreenCaptureKit quietly returns a stream containing only the desktop picture. **It does not go black.** Every check passes: right display, right UUID, `type: 0`, correct resolution, source enabled, frames flowing. | System Settings → Privacy & Security → **Screen & System Audio Recording** → toggle OBS **off then on** (seeing it already on is not enough — the toggle is what re-mints the grant), then **quit and relaunch OBS**. Jump straight there with `open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"`. |
| **Camera bubble missing; Cam / Cam Cutout black** | The Camera input points at a Continuity Camera device that no longer exists — the IDs are per-phone, so swapping handsets orphans every camera scene. The source resolves to 0x0 and simply doesn't draw. | Self-healing since 2026-08-01: `camera-picker` re-points Camera and Camera FX on every OBS connect and logs a warning. If it ever can't, press the Camera Picker key. |
| **Black bars down the sides of a screen share** | The built-in MacBook panel is 3456x2234 (aspect 1.547) and the canvas is 16:9 — fitting the whole screen inside it letterboxes. Measured 125px of pure black each side. The external monitor is natively 16:9, so only one screen looks wrong. | `node scripts/add-look.mjs screens` — crops each capture to canvas aspect before fitting, biased to trim the top (menu bar) so the loss lands on chrome, not content. Nothing is upscaled. |
| **A deck key shows a yellow `?`** | The key points at a plugin action that no longer ships — the profile and the code drifted. | `node scripts/check-deck.mjs` names every one, then `node scripts/build-profile.mjs`. |
| **Record key insists it's recording when OBS isn't** | Fixed 2026-08-01 — it used to trust a cached flag and miss the stop edge. It now re-reads `GetRecordStatus` on every press and reconciles every 5s. | Shouldn't recur; if it does, the log records every `RecordStateChanged`. |

## Verify after changes

1. `node scripts/check-deck.mjs` → zero orphaned keys, zero unplaced actions.
2. Quit OBS → press the **OBS** key (power symbol) → OBS returns on *Starting
   Soon* (~20 s) and every key repaints with live state.
3. Press each screen key → **look at the picture**, not just the key: it must
   show real windows, not the bare wallpaper.
4. Flip through scene keys; record ~10 s → playable file in `~/Movies`.
5. Press **Mark** twice while recording → `ffprobe` shows the chapters
   (media-studio `scripts/verify_record_chapters.py`).
