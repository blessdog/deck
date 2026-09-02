---
id: the-deck-ends-at-the-mp4
kind: law
conflict-key: where-the-deck-stops-and-what-it-hands-over
status: live
supersedes: []
verified-on: 2026-09-02
asked-as:
  - should the deck send the recording to media-studio
  - do we build a finish key that ingests the file
  - where does obs-control-room stop
  - what happens to the MP4 after recording
  - should record stop trigger the pipeline
---

**The deck stops at the MP4. It never hands a file downstream. The one
concession is a key that REVEALS the recording so Ryan can drag it himself.**

Ryan, 2026-09-02: *"No, it should stop at the MP4. But make a button that's a
shortcut to the video file so I can drag those in individually. I do lots of
short videos or often need to edit multiple videos together. So sending one
single video over after I finish it won't suit the workflow."*

Why a finish-and-ingest key is wrong here, in mechanism: his unit of editing is
not one recording. He cuts several snippets together, so a per-recording
handoff fires at the wrong grain and would have to be undone in the editor.
The right grain is a folder he drags from.

How to apply: the reveal key opens `~/Movies` with the newest recording
selected (Finder reveal), nothing more. No ingest CLI, no Resolve, no
media-studio import from this repo. The tripwire greps for it.

Related: [[recording-friction-is-the-product]].
