# grab-router — never wired, archived 2026-09-02

**What it was:** `grab.mjs`, a router for the GRAB key: video URLs to rectum's
clip library, image URLs to media-tools' image library, with clipboard-vs-front-
tab pre-fill rules. Written in a session before 2026-09-02 and left untracked.

**Why it is here:** nothing calls it. The GRAB key (`plugin/src/actions/rectum.ts`)
runs `python3 -m rectum grab`, and rectum's own `cmd_grab` asks for the URL and
fetches it. The router was a second implementation of the same key with one more
branch (images), and a second implementation nobody routes to is exactly the
dead-in-the-live-tree code the archive law forbids.

**Re-run when:** Ryan wants the GRAB key to take image URLs too. Then this is
the design: the deck is the composition layer that may call both rectum and
media-tools, because neither may depend on the other.
