# CLAUDE.md — deck (was obs-control-room until 2026-09-02)

**Read `README.md` first** — it is the manual: the plugin's actions, the build
loop, the scene collection, the Stream Deck gotchas. This file only says how to
work here. Ryan's cross-project working agreement is in `~/.claude/CLAUDE.md`.

## What this is, and what it is NOT

**Everything the Stream Deck does**, in one repo, sectioned so nothing bleeds:
`plugin/` (the one plugin, UUID `com.blessdog.obs-control-room` — never renamed,
renaming it blanked every key once), `scripts/` (the layout as data, the profile
writer, the tripwire), `obs/` (scenes, looks, verifiers), `rectum/` (clipper
key glue), `ableton/` (reserved). Laws and measured verdicts are in `knowledge/`;
query it before choosing a technique.

It ends at the file. OBS writes Hybrid MP4 to `~/Movies`; **`~/projects/media-studio`
ingests from there and owns everything downstream** — timelines, edits, grades,
delivery. The boundary is the MP4 on disk. Do not reach across it: no Resolve
code here, no OBS code there.

**A session opened in this directory does not need media-studio's context.**
That is the point of this file. If you find yourself needing it, the boundary
is being violated — stop and say so.

## Doctrine (learned the hard way, 2026-08-01)

- **Verify by exercising, never by observing.** Five silent failures landed in
  one day — dead deck keys, a camera pointed at a phone Ryan no longer owns, a
  latched record key, a screen capture returning only wallpaper, and a Lua
  script that registered its hotkeys then died on every callback. Every one
  passed every machine-side check. All five were found by Ryan looking at the
  actual thing. A verifier must *do the thing*, not read state about it.
- **Never trust cached state.** Re-query OBS; do not believe your own last write.
- **Ryan records screen-shares and commentary — he does not stream.** Broadcast
  and stream-health features are parked. Do not build them.
- **"Build not buy" means study the ecosystem first, then build.** Inverting it
  produced a deck with five dead keys. The survey is
  `~/projects/media-studio/docs/DECK-MARKET-2026-08-01.md`.
- **Faces are measured off Elgato's own art**: state = whole-key background
  colour, white line-art icon, text only for numbers that change.

## Ryan's calls

- **His eyes are the verdict on anything visual.** Render it, `open` it, or ask
  him to press the key. Never declare a face or a scene good unseen.
- Architecture and trust boundaries are his. Propose; do not build past a block.

## Artifacts need an owner

Before creating any file, name its writer, its reader, and what fails when it
is wrong. If any of the three is blank, do not create it.
