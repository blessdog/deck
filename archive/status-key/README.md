# status-key — removed 2026-09-02

**What it was:** the STATUS key: OFFLINE / READY / REC / LIVE with elapsed time
and dropped-frame %, cold-starting OBS on press while offline.

**Why it went:** law `knowledge/recording-friction-is-the-product.md`. Every
scene key already cold-starts OBS, so the launcher was a duplicate; its REC
state duplicated the RECORD key; LIVE never happens because Ryan does not
stream. Ryan: "I don't need the ready button because usually I'll just press
the screen-and-me because I know that actually works and it opens the OBS app."

**Re-run when:** Ryan streams. Then LIVE and dropped frames matter and this key
is the dashboard.
