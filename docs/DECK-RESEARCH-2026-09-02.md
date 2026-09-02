# The deck, 2026-09-02 — what is dead, why, and what raises production value

*Report before build. Ryan's brief: "look up what creative content makers,
especially using OBS, bigger YouTube channels are doing to enhance the video
production quality… then we can wire those into the Stream Deck."*

Verification tags: **[M]** measured on this machine today · **[V-src]** vendor
source or maintainer statement · **[V-rel]** release asset checked on GitHub ·
**[2nd]** secondary write-up · **[?]** unverified.

---

## 1. Verdicts Ryan gave today (filed as laws in `knowledge/`)

| Law | In his words |
|---|---|
| `the-deck-ends-at-the-mp4` | "It should stop at the MP4. But make a button that's a shortcut to the video file so I can drag those in individually." |
| `recording-friction-is-the-product` | "The easier it is for me to just press a button and start recording these snippets… that ease of use and lack of friction keeps me creating content." The Ready key goes: "I'll just press the screen-and-me because I know that actually works and it opens the OBS app." |

Bookmarked, not built: SP-404 sound library and Ryan's own recordings on the
deck. That is the `ableton/` section, after OBS is solid.

## 2. The deck as it sits **[M]**

Tripwire green: 17 keys on XL page 1, 4 rectum keys on page 2, 8 on the SD+.
Record works: three recordings today in `~/Movies`, 6 GB. OBS 32.2.2.

| Key | Ryan's read | Measured mechanism | Fix |
|---|---|---|---|
| **Cutout** | does nothing | `Camera FX` has Background Removal **OFF** and a green-screen Chroma Key **ON** with no green screen. Output is the raw camera with holes in the plant. Installed remover is royshil 1.1.13 on `useGPU: cpu`, mediapipe model. | Section 3.3 |
| **Me + Float** | does nothing | Scene item order is Camera(0) → Float Plate(1) → **Display(2) at full frame on top**. The camera is buried; the scene renders identical to Screen L. | Re-run `add-look.mjs float`, verify by snapshot |
| **Zoom** | (not raised) | OBS still registers the Lua at `~/projects/obs-control-room/vendor/…` — the **pre-move path**. Same incident that blanked every key on 2026-08-18. Script not loaded; `verify-zoom.mjs` confirms. | Section 3.1 decides which zoom; if Lua, `install-zoom.mjs` with OBS quit |
| **Phone** | unknown | Camera Picker: cycles iPhone Continuity ↔ built-in FaceTime. Works. | Keep, better glyph |
| **Ready** | pointless | Status key. Its only unique job (cold start) is already done by every scene key. | Remove |
| **Lava Lounge** | — | Lava Lamp source reports 0×0 while inactive; asset exists (63 MB). Scene = lamp under Cam Cutout, so it inherits the cutout failure. | Fixed by 3.3 |
| **Screen L / Screen + Cam** | works | Every snapshot today shows the desktop wallpaper only. Either the left monitor was empty, or the Screen Recording grant went stale again (README table). **Ryan to check by eye.** | Toggle grant if stale |

Evidence: `evidence/2026-09-02/dead-keys-contact-sheet.png` (opened for Ryan).
Frame rate is 30 fps, not the 60 the README claims **[M]**; README corrected in this pass.

## 3. What raises production value for screen-share creators

The recurring set across the guides and the plugin ecosystem, filtered to what
Ryan makes (recorded screen-share with commentary, several snippets cut
together in Resolve):

### 3.1 Zoom on the cursor — the single biggest lift for screen content

Three real options. Two are in-OBS (only the recording zooms); one is the
system (Ryan sees what viewers see).

| Option | How it works | macOS | Trigger from deck | Status |
|---|---|---|---|---|
| **macOS Accessibility Zoom** (Ryan's ask: "native Apple features") | Compositor zoom, follows the mouse, smooth. **OBS Display Capture records it** — OBS maintainer, issue #9919: *"We use the image that macOS gives us, and that includes the zoom."* A 2026 write-up claims the opposite; the maintainer wins. One open report of glitching on 32.0.2 (#12940). Hotkeys currently **disabled** on this Mac (`closeViewHotkeysEnabled = 0`). | native | Hotkey key: ⌥⌘8 toggle, ⌥⌘= / ⌥⌘− in/out | **[V-src]** capture; **[M]** needs exercising here |
| **Zoominator** (mmlTools) | OBS plugin: scene-level zoom + follow, smart clamping, idle freeze, optional click halo. v2.0.4, 2026-08-25, `macos-universal.pkg`. Author: "cannot guarantee stable performance on macOS". | pkg | OBS hotkey by name over websocket (same path the Lua used) | **[V-rel]** |
| **obs-zoom-to-mouse Lua** (vendored, patched for OBS 32) | What we have. Worked 2026-08-01 after the `_info2` patch. | yes | `TriggerHotkeyByName` | **[M]** dead only because of the path |

Decision method: exercise all three on the same 10-second pass and snapshot
each. Ryan's eyes decide. Native zoom is the cheapest to wire and the only one
he also sees live; that is why it is first in the test order.

Adjacent, cheap, and captured by OBS because they are window overlays:
**cursor highlight / click ripple** — Mouzz (free), Presentify ($14.99),
TuringShot (free tier, real-time zoom + drawing by ⌃A-scroll). **[2nd]**

### 3.2 Camera shots that move

- **Move transition (Exeldro)** — animates source position/size between
  scenes instead of cutting. v3.2.1, `macos-universal.pkg`, 2.3 M downloads.
  Already on the README "Next" list since August. Cam ↔ Me + Float ↔ Screen +
  Cam share one Camera source, which is exactly what Move matches on. **[V-rel]**
- **Source Record (Exeldro)** — records one source to its own file. A clean
  camera ISO alongside the screen recording means every reframe happens in
  Resolve, which suits "edit multiple videos together". v0.4.8,
  `macos-arm64.pkg`. **[V-rel]** Cost: a second file per take.
- **Second angle** — `media-studio/docs/IPHONE-MULTICAM.md`, written
  2026-07-21, never run. Camera Picker already switches devices; a second
  device is a second scene key.

### 3.3 Cutout that actually cuts

| Option | Mechanism | Status |
|---|---|---|
| **royshil obs-backgroundremoval** (installed, 1.1.13) | ONNX/CoreML segmentation. Currently on CPU + mediapipe. Switching to CoreML + a better model is a settings change. | **[M]** installed, mis-set |
| **macOS Background Removal** (gxalpha / beckmann fork) | Apple Vision, on-device, same engine as Portrait mode. 4.67★, 18,953 downloads; last release 2023, forks maintained. Praised on Apple Silicon. | **[V-src]** |
| Chroma key | needs a green screen. Ryan has none. | **[M]** wrong tool |

Method: same as zoom. Both filters on `Camera FX`, one enabled at a time,
snapshot, Ryan decides.

### 3.4 Reuse, don't rebuild — the official Elgato OBS plugin

Installed. Its actions cover what we lack and none of it is worth owning:
**Record Pause**, **Replay Buffer / Save Replay**, **Screenshot**, **Source
show/hide**, **Filter toggle**, **Transition select**, **Mute with
push-to-talk / push-to-mute**, **Media control**, **Audio Mixer Volume on SD+
dials**. **[V-src]** Our plugin keeps what needs *state that never lies*
(record, mark, mute face, scene faces, camera picker, rectum). Both plugins
coexist on one profile; `deck-layout.mjs` already tolerates foreign keys.

Note: Record Pause requires a fragmented container. Hybrid MP4 supports it in
OBS 30+; verify by pressing. **[?]**

### 3.5 Automation

**Advanced Scene Switcher** v1.36.1, `macos-universal.pkg`: macros on window
focus, audio level, hotkey, media state. **[V-rel]** Useful later (e.g. auto
Screen + Cam when Resolve is focused). Not in this pass: it adds a config
surface, and the deck's problem today is dead keys, not missing automation.

### 3.6 Parked, on purpose

Stream health, dropped frames, tally, instant-replay chat triggers: Ryan
records, he does not stream. Finish-and-ingest key: refused by law today.
Soundboard: bookmarked with the SP-404.

## 4. Mono project — one repo, sections

`obs-control-room/` already is the Stream Deck mono project: the plugin, the
layout-as-data, the rectum page. `streamer/` and `OBS/` beside it are empty
and go. Proposed:

```
deck/                      ← renamed from obs-control-room (GitHub repo too)
  plugin/                  the one Stream Deck plugin; UUID stays (renaming it blanked every key once)
  scripts/deck-layout.mjs  the layout, all pages, all devices
  obs/                     scenes, looks, OBS-side installers and verifiers
  rectum/                  the clipper keys' glue (rectum itself stays its own repo)
  ableton/                 reserved — the SP-404 bookmark lands here
  docs/  evidence/  knowledge/
```

## 5. Draft key set v2 (for Ryan's verdict, after the tests in 3.1 and 3.3)

```
 ·        ·        ·        ·      SOON     BRB    ENDING   RECORD    row 0 — far
 ·        ·        ·        ·        ·        ·       ·     PAUSE     row 1 — gutter (pause beside record)
 LEFT    RIGHT   SCRN+ME    ·      CAM    CUTOUT  ME+FLOAT  LAVA     row 2 — what's on screen
 MARK    MUTE    ZOOM     REVEAL  CAMERA  MEETING  SHOT     (nav)   row 3 — nearest the hand
```

New: **REVEAL** (Finder, newest recording selected), **PAUSE** (official plugin),
**SHOT** (screenshot, official plugin). Gone: STATUS. SD+ dials: Mic, SP-404,
App Audio via the official Audio Mixer Volume action.

## 6. What Ryan has to look at

1. Press **Screen L** now: real windows, or wallpaper?
2. Zoom bake-off: three snapshots, one verdict (3.1).
3. Cutout bake-off: two snapshots, one verdict (3.3).
4. Key set v2 above.

Sources: [OBS issue #9919](https://github.com/obsproject/obs-studio/issues/9919) ·
[OBS issue #12940](https://github.com/obsproject/obs-studio/issues/12940) ·
[Zoominator](https://github.com/mmlTools/zoominator) ·
[Move](https://github.com/exeldro/obs-move-transition) ·
[Source Record](https://github.com/exeldro/obs-source-record) ·
[macOS Background Removal](https://obsproject.com/forum/resources/macos-background-removal.1691/) ·
[royshil obs-backgroundremoval](https://github.com/royshil/obs-backgroundremoval) ·
[Elgato OBS plugin actions](https://www.elgato.com/us/en/explorer/products/marketplace/streamline-your-production-with-the-obs-studio-plugin-for-stream-deck/) ·
[macOS zoom tools comparison, 2026](https://dev.to/dave_lee_f99c54a1688d407b/ive-been-recording-coding-tutorials-for-10-years-heres-my-comparison-of-every-macos-screen-zoom-3opf) ·
[Mouzz](https://mouzz.dev/) · [TuringShot](https://www.turingshot.site/) ·
[Advanced Scene Switcher](https://github.com/WarmUpTill/SceneSwitcher)
