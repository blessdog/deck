# Design — the Stream Deck mono project ("deck"), 2026-09-02

Approved by Ryan ("onward"), 2026-09-02. Research and measurements behind it:
`docs/DECK-RESEARCH-2026-09-02.md`. Laws in `knowledge/`.

## Goal

One repo for everything the Stream Deck does, sectioned so OBS, the clipper
and (later) Ableton cannot bleed into each other, with every key on the deck
doing one visible thing. The point of the deck is that starting a snippet
recording costs nothing (`recording-friction-is-the-product`) and what gets
recorded looks produced.

## Non-goals (by law or verdict)

- No ingest, no Resolve, no media-studio call from this repo (`the-deck-ends-at-the-mp4`).
- No stream health, tally, replay-to-chat. Ryan records; he does not stream.
- No Status/Ready key. Every scene key already cold-starts OBS.
- No SP-404/Ableton keys in this pass (bookmarked).

## Structure

```
deck/                                  ← obs-control-room renamed; GitHub repo renamed the same day
  plugin/                              the one Stream Deck plugin. UUID com.blessdog.obs-control-room STAYS.
  scripts/deck-layout.mjs              THE layout: every device, every page, ours and native keys
  scripts/build-profile.mjs            writes the layout; check-deck.mjs is the tripwire
  obs/                                 add-look, setup-scenes, set-*, install-zoom→archive, snapshot, lib/obs.mjs
  rectum/                              grab.mjs and anything else that glues clipper keys
  ableton/README.md                    reserved; points at the bookmark
  archive/                             obs-zoom-to-mouse.lua + zoom.ts, with the measured reason
  docs/ evidence/ knowledge/
```

`streamer/` and `OBS/` in the workspace folder are empty and are removed.
`mediaStudio/README.md` table row updated to `deck/`.

Renaming the plugin UUID is forbidden: it blanked every key on 2026-08-18.

## Key set v2

XL page 1 (row 3 nearest the hand; column 3 is the tactile gutter and stays dark):

```
 ·         ·         ·         ·       SOON     BRB     ENDING   RECORD    row 0 — far
 ·         ·      ZOOM OUT    ·         ·        ·        ·      PAUSE     row 1 — gutter, two exceptions
 LEFT     RIGHT    SCRN+ME     ·       CAM    CUTOUT  ME+FLOAT   LAVA     row 2 — what's on screen
 MARK     MUTE    ZOOM IN     ·       CAMERA  MEETING   SHOT    REVEAL    row 3 — nearest the hand
```

ZOOM OUT sits directly above ZOOM IN and PAUSE directly below RECORD, so each
pair is found by touch; the rest of row 1 stays dark.

Page 2 (rectum) unchanged. SD+ keys: `LEFT RIGHT SCRN+ME RECORD / MARK MUTE CAM
REVEAL`; SD+ dials 1–3: Mic, SP-404, App Audio via the official Elgato OBS
plugin's Audio Mixer Volume action; dial 4 untouched.

Gone: STATUS. Kept as-is: RECORD, MARK, MUTE, CAMERA, MEETING, all scene keys.

## What each new or changed key does, and how it is proven

| Key | Mechanism | Proof (Ryan presses, I snapshot through OBS or look at the result) |
|---|---|---|
| **ZOOM IN / OUT** | Native Stream Deck Hotkey actions sending ⌥⌘= and ⌥⌘−. macOS Accessibility Zoom with keyboard shortcuts on, panning mode "keep pointer centered" (chosen; Ryan's eyes may change it). Owned by macOS, not by us. | Zoom in on the left monitor; Screen L snapshot shows the zoomed picture (OBS maintainer: display capture includes zoom). If it does not, that is a refuted claim and the Lua comes back from archive. |
| **CUTOUT** | `Camera FX`: Chroma Key removed; Background Removal enabled, `useGPU` CoreML, model selected by look. Scene order and geometry untouched. | Snapshot of Cam Cutout with Ryan in frame shows him on a transparent/lava background, not the room. |
| **ME + FLOAT** | `add-look.mjs float` re-run; adds an explicit z-order step (Camera bottom, Float Plate, Display card on top at 52% width lower-right). | Snapshot shows full-bleed camera with the screen as a card. |
| **PAUSE** | Our plugin: `ToggleRecordPause` over websocket; face from `RecordStateChanged` (paused state), dim when not recording. Hybrid MP4 supports pause on OBS 30+; the proof is a paused-then-resumed file that plays. | Press mid-recording, resume, play the file. |
| **SHOT** | Our plugin: `SaveSourceScreenshot` of the program scene to `~/Movies/OBS Shots/<timestamp>.png`, then Finder reveal. | Press; the PNG opens. |
| **REVEAL** | Our plugin: `GetRecordDirectory`, newest `*.mp4`, `open -R`. No ingest. | Press after a recording; Finder shows the file selected. |
| **SCREEN L** | If Ryan sees wallpaper with windows open: Screen Recording grant toggled off/on, OBS relaunched. | Screen L snapshot shows windows. |
| **Move transition** | Exeldro Move 3.2.1 `macos-universal.pkg`; set as the transition between Cam / Me + Float / Screen + Cam. | Ryan presses CAM then ME+FLOAT and sees the camera slide, not cut. |
| **Dials** | Official Elgato OBS plugin Audio Mixer Volume, placed by `build-profile.mjs` from harvested settings. | Turn a dial, the OBS mixer moves. |

PAUSE, SHOT and REVEAL are owned by our plugin rather than the official one
because each is one websocket call on a connection we already hold, and the
face must follow OBS's own state (the never-lies doctrine). The dials are the
official plugin's because encoder feedback is real work and theirs is proven.

## Layout-as-data grows two things

1. **Native and foreign keys in `deck-layout.mjs`.** Today the layout can only
   place our plugin's actions. It gains entries of the form
   `{ uuid, name, settings }` for Stream Deck's own Hotkey action (zoom keys)
   and the official OBS plugin's dial action. Settings shapes are harvested
   once from a hand-placed key and committed; `check-deck.mjs` verifies they
   still resolve.
2. **Every action names its exercise.** `check-deck.mjs` fails if a shipped
   action has no `verify:` line in the layout — the one-sentence human test
   above. It is a tripwire for the "key that does nothing" class, not
   automation.

## Archive, never delete

`vendor/obs-zoom-to-mouse.lua`, `plugin/src/actions/zoom.ts`,
`scripts/install-zoom.mjs`, `scripts/verify-zoom.mjs` move to `archive/zoom-in-obs/`
with a header: superseded by `zoom-is-native-macos-zoom`, measured reason (Ryan
cannot see the framing he is producing). `status.ts` moves to `archive/` too.

## Order of work

1. Fixes on the live deck (Cutout, Me + Float, Zoom keys, Screen L check) — each verified by Ryan's press.
2. New keys: REVEAL, PAUSE, SHOT.
3. Move transition + dials.
4. Rename and section the repo; update the workspace README; remove the empty folders.
5. README journey entry; STATE regenerated.

Rename comes after the fixes so a broken deck is never blamed on a moved path
twice in one month.
