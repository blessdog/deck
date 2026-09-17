---
id: grab-files-every-slide-of-a-carousel
kind: verdict
conflict-key: why-a-grab-downloads-but-finder-never-opens
status: live
supersedes: []
scope: GRAB deck key -> `python3 -m rectum grab` (rectum cad3966), yt-dlp 2026.08.19 + gallery-dl 1.32.12, Instagram /p/ posts and carousels of videos, photos or both, macOS 26 Finder
evidence: plugin log 2026-09-17T21:26–21:30Z, four `grab` errors "Output file does not contain any stream"; ~/Movies/rectum-clips held 32 mp4s with no ledger entry (4 runs x 8 slides; the 9th, silent, was deleted each run); synthetic silent mp4 reproduces the ffmpeg message, exit 234; after the fix the same 8 files filed in one pass and Finder's selection count was 8
verified-on: 2026-09-17
asked-as:
  - why does the grab not open the folder
  - is the grab not downloading
  - grab key flashed an alert and nothing happened
  - instagram carousel grab downloaded the wrong slide
  - grab failed on a video with no sound
  - grab says no video formats found
  - can the grab key download photos or images
  - where do grabbed instagram photos go
---

**A grab that downloads but never opens Finder has failed AFTER the download.
On 2026-09-17 the cause was two defects in rectum's `fetch`, both fixed in
rectum `d7ee0bf`: a video with no audio track was deleted, and only the first
slide of a carousel was ever filed.**

Mechanism, in order:

1. An Instagram carousel is a playlist to yt-dlp. `--no-playlist` does not
   narrow it and `img_index=N` in the URL is ignored (yt-dlp #12983), so every
   slide downloads whatever was asked for.
2. `fetch()` read only the first printed line, so slides 2..N landed on disk
   with no ledger entry. A grab of `img_index=3` quietly filed slide 1.
3. When slide 1 has no audio stream, `ffmpeg … -vn out.wav` exits 234 with
   "Output file does not contain any stream". That was treated as a failed
   download: the video was deleted, nothing was filed, `open -R` never ran.
4. The deck key's only failure signal is a one-second alert glyph; the reason
   went to `plugin/…sdPlugin/logs/*.log`.

Now: every slide is filed; a silent clip is filed with `wav: ""`; Finder opens
with all of them selected (`open -R a b c` selects ONE — measured 8 in, 1
selected — so a multi-file reveal goes through Finder's `reveal`); a failed
grab shows its reason in a dialog.

**Amended the same day — photos.** A carousel can mix videos and photos
(`/p/C7lNc_DPenq`: five and three). yt-dlp cannot download Instagram photos;
each photo slide is a "No video formats found" error and the run exits 1, which
rectum used to treat as a failed grab — the five videos were orphaned. Ryan:
"some are images. it should grab either / both", in "a rectum image folder".
Now (rectum `549e42c`, `cad3966`): yt-dlp's exit code is not the verdict, what
it printed is; and a second pass with gallery-dl, filtered to image extensions,
files the photos into `images/` inside the clip library with `images.json`.
Exercised on that post: 5 clips + 3 photos, Finder opened on both folders.

A trap worth keeping: the ID in yt-dlp's error (`C7lNc4nvYEF`) was a SLIDE, not
the post. "0 formats, 13 thumbnails" was read as "the post is a photo" and
Ryan, looking at the post, said "youre wrong thses are videos". Both were true
of different URLs. The tell in Instagram's API response is `media_type: 1` with
`is_sidecar_child: true`; the post is the front tab's URL, not the ID in the error.

Where the files go when the SSD is unplugged: `~/Movies/rectum-clips` (rectum
`d5f4127`), not `/Volumes/BleSSD/clips`.

Still open: Instagram answered HTTP 400 "Video info extraction failed" to the
same Brave session right after the four grabs plus three probes. Seven requests
in ~70 minutes preceded it; whether that is a rate limit was not measured.

First place to look next time: `grep grab plugin/com.blessdog.obs-control-room.sdPlugin/logs/*.log | tail`.
