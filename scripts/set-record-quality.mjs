#!/usr/bin/env node
/**
 * Raise the recording bitrate.
 *
 * Found 2026-08-01 from a real file rather than the config ("the video quality
 * isn't as good as I would expect... fairly grainy for being an HD camera"):
 * ffprobe on ~/Movies showed h264 High, 1920x1080, 60fps, **13.9 Mbps**.
 *
 * That is thin for this setup, for two compounding reasons:
 *   - it's spread over 60fps, so ~230 kbit per frame;
 *   - the encoder is Apple's HARDWARE AVC (videotoolbox), which needs roughly
 *     1.5-2x the bitrate of x264 for equivalent quality.
 * Camera noise is expensive to encode, so a starved encoder smears it rather
 * than resolving it — which is exactly what reads as "grainy".
 *
 * This is recording to a local disk, not streaming, so bitrate is nearly free:
 * 45 Mbps is about 340 MB/min. The corpus doctrine already accepts that
 * recordings pile up in ~/Movies.
 *
 * Deliberately NOT switching to HEVC. It would be ~40% more efficient, but the
 * whole media-studio pipeline is verified end-to-end on h264+AAC hybrid MP4
 * (STATUS.md, 2026-07-12) and swapping the codec means re-proving ingest. Worth
 * doing on purpose, not as a side effect of a quality tweak.
 *
 * OBS rewrites its profile on exit, so it must be QUIT before running this.
 *
 *   node scripts/set-record-quality.mjs [kbps]     # default 45000
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";

const KBPS = Number(process.argv[2] ?? 45000);
const PROFILE = join(homedir(), "Library/Application Support/obs-studio/basic/profiles/Untitled");
const REC = join(PROFILE, "recordEncoder.json");

if (!Number.isFinite(KBPS) || KBPS < 1000 || KBPS > 200000) {
	console.error("bitrate must be between 1000 and 200000 kbps");
	process.exit(1);
}
try {
	execFileSync("/usr/bin/pgrep", ["-x", "OBS"], { stdio: "ignore" });
	console.error("OBS is running — quit it first, or this write is discarded on exit.");
	process.exit(1);
} catch {
	/* not running, good */
}
if (!existsSync(REC)) {
	console.error(`No recordEncoder.json at ${REC}`);
	process.exit(1);
}

const cfg = JSON.parse(readFileSync(REC, "utf8"));
const before = cfg.bitrate;
cfg.bitrate = KBPS;
if (!existsSync(REC + ".bak")) copyFileSync(REC, REC + ".bak");
writeFileSync(REC, JSON.stringify(cfg));

const mbPerMin = Math.round((KBPS / 8 / 1024) * 60);
console.log(`record bitrate: ${before} -> ${KBPS} kbps  (~${mbPerMin} MB/min)`);
console.log(`backup: ${REC}.bak`);
console.log(`\nStart OBS and record ~10s, then confirm with:`);
console.log(`  ffprobe -v error -select_streams v:0 -show_entries format=bit_rate \\`);
console.log(`    -of default=noprint_wrappers=1 "$(ls -t ~/Movies/*.mp4 | head -1)"`);
