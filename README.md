# OBS Control Room

One-button screen shares and streaming: Stream Deck → OBS, with a scripted
scene collection, a cold-start launcher, and a custom Stream Deck plugin.

## Custom plugin (`plugin/`)

`com.blessdog.obs-control-room` — bespoke actions (Elgato SDK v2, Node 24),
in the Stream Deck app under category **"OBS Control Room"**:

| Action | Behavior |
|---|---|
| **Show Flow** | Press: cold-start OBS → *Starting Soon* → 10s countdown (press again cancels) → *Screen + Cam* → live. **Hold 1.5s while live**: *Ending* for 3s → stream stops. |
| **Screen Picker** | Toggles the shared Display capture between built-in and external. Key shows which is live. |
| **Status** | OFFLINE / READY / ⏺ REC / 🔴 LIVE with elapsed time + dropped-frame %. Press while offline = cold start. |
| **Meeting Mode** | *Screen + Cam* + OBS Virtual Camera on/off — then pick "OBS Virtual Camera" in Zoom/Meet. |
| **Record** | Toggle the OBS recording (cold-starts OBS if dead). Amber ⏺ + elapsed while rolling. Corpus doctrine: recordings pile up in `~/Movies`; processing is a separate, later act. |
| **Mark** | While recording: drops an OBS **chapter marker** into the file itself, named with the record timecode. No daemon, no DB — ffprobe reads chapters back at ingest (verified: media-studio `scripts/verify_record_chapters.py`; OBS auto-adds a `Start` chapter at 0, ingest skips it). Dim + alert when not recording. |
| **Scene keys** | One key per scene (all seven, incl. **Cam Cutout**), zero config; the on-air key lights up. |

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
| `scripts/setup-scenes.mjs` | Builds the **"Control Room"** OBS scene collection over obs-websocket. Re-run with `--force` to wipe and rebuild. |
| `scripts/cold-start.mjs` | Launches OBS if needed, lands on *Starting Soon*. Flags: `--virtual-cam`, `--and-stream`. |
| `scripts/set-stream-key.mjs` | One-time: `node scripts/set-stream-key.mjs <KEY>` points OBS at YouTube RTMPS. Key lives in OBS config, never in this repo. |
| `OBS Cold Start.app` | Wrapper the Stream Deck 🚀 key opens (runs `cold-start.command`, logs to `logs/cold-start.log`). |
| `scripts/set-display.mjs` | Point the Screen capture at the built-in display (default) or `--external`. |
| `scripts/snapshot.mjs` | Save a PNG of a scene's program output. **Broken on OBS 32.1.x** — GetSourceScreenshot returns transparent frames; verify via a short recording instead. |
| `scripts/lib/obs.mjs` | Shared connect helper. Reads port/password from OBS's own websocket config (SSOT) and waits until OBS is actually ready (error-207 poll). Also `displayUUIDs()` via CoreGraphics, since OBS 32.1.x hangs on display enumeration. |

## Scenes

`Starting Soon` · `Screen` · `Cam` · `Cam Cutout` · `Lava Lounge` · `Screen + Cam` (camera bubble bottom-right) · `Ending`

One shared `Display` / `Camera` / `Mic` input reused across scenes — edit a device
once, every scene follows.

## State — 2026-07-21 (deck framework locked in)

This project is now THE Stream Deck surface, full stop (Ryan's reel-in: the
deck does one thing well — OBS; Resolve profiles and daemon-verb keys are
dropped; the pipeline side lives in `~/projects/media-studio`, see its
STATUS.md). Landed this session: **Record**, **Mark** (chapter markers),
**Scene: Cam Cutout**, a **glyph layer** in `key-face.ts` (`GLYPHS`:
house/record/stop/mark/play — icon-first faces per Ryan's grammar: the
picture says what the key does, text only for state detail), and the
end-show bug fix (StopStream on an already-dead stream threw). Built,
loaded, OBS-connected clean; **finger-verification on the physical deck
still pending**.

**Next (fresh session, in order):**
1. **HOME nav shell** — deck as launcher: a HOME profile with app tiles
   (OBS now; Ableton/soundboard later); a house-glyph key on the SAME
   corner of every profile (proposed bottom-right) via the built-in
   *Switch Profile* action. Profiles are created in the Stream Deck app
   GUI with Ryan (his hands/eyes); `GLYPHS.house` is the art source.
2. **Icon-first art pass** over all faces + Marketplace-grade action
   icons (Elgato Key Creator / authored SVG; emoji-render acceptable v1).
3. **Retire the Companion "MEDIA STUDIO" page** once Ryan's fingers
   confirm the plugin keys cover it (Companion config-by-sqlite doctrine:
   media-studio `docs/DECK.md`).
4. Corpus auto-index of `~/Movies` — lands in media-studio's daemon, not
   here.

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
3. **Stream Deck**: install the OBS Studio plugin from Marketplace, then drag the
   actions onto keys per the layout above. The plugin picks up the websocket
   connection (port 4455) automatically; password is in
   `~/Library/Application Support/obs-studio/plugin_config/obs-websocket/config.json`.

## Verify after changes

1. Quit OBS → open `OBS Cold Start.app` → OBS returns on *Starting Soon* (~20 s).
2. Flip through scene keys; ⏺ record ~10 s → playable file in `~/Movies`.
3. 📹 Virtual Cam on → "OBS Virtual Camera" appears in Zoom/Meet/Photo Booth —
   that's the polished meeting screen-share path.
