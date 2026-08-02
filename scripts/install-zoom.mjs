#!/usr/bin/env node
/**
 * Register `vendor/obs-zoom-to-mouse.lua` with OBS and configure it for this
 * rig. Zoom-to-cursor is the single highest-value key for a screen-share
 * commentary workflow — its author wrote it "to zoom into an IDE when
 * highlighting certain sections of code", which is exactly the job.
 *
 * OBS keeps loaded scripts in the SCENE COLLECTION json, and rewrites that file
 * from memory when it exits — so editing it under a running OBS is silently
 * discarded. Same discipline as the Stream Deck app: quit first.
 *
 *   (quit OBS)
 *   node scripts/install-zoom.mjs
 *   (start OBS)
 *
 * The deck key does NOT emulate a keystroke. The script registers a frontend
 * hotkey, and obs-websocket can fire it by name (TriggerHotkeyByName), so the
 * Zoom action in our plugin calls it directly over the socket we already hold —
 * no OS hotkey, no Accessibility permission, nothing to collide with.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const LUA = join(REPO, "vendor", "obs-zoom-to-mouse.lua");
const COLLECTION = join(
	homedir(),
	"Library/Application Support/obs-studio/basic/scenes/Control_Room.json",
);

// Which capture the zoom acts on. The external/left display is the clean 16:9
// full-frame share and is NOT Retina, so its pixels map 1:1 to the source and
// the mouse maths stays honest. (Zooming the built-in would need scale 2 in the
// override block below — its capture is 3456x2234 for a 1728x1117 desktop.)
const ZOOM_SOURCE = "Display";

if (!existsSync(LUA)) {
	console.error(`Missing ${LUA} — fetch it first:
  curl -fsSL -o vendor/obs-zoom-to-mouse.lua \\
    https://raw.githubusercontent.com/BlankSourceCode/obs-zoom-to-mouse/main/obs-zoom-to-mouse.lua`);
	process.exit(1);
}
if (!existsSync(COLLECTION)) {
	console.error(`No Control Room collection at ${COLLECTION}`);
	process.exit(1);
}
if (obsRunning()) {
	console.error(
		"OBS is running. Quit it first — it rewrites this file on exit and would\n" +
			"throw away anything written underneath it.",
	);
	process.exit(1);
}

// The display this zoom source captures, straight from CoreGraphics, so the
// override never drifts from the real desk arrangement.
const displays = JSON.parse(
	execFileSync("/usr/bin/python3", [
		join(REPO, "plugin/com.blessdog.obs-control-room.sdPlugin/display-uuids.py"),
	]),
).sort((a, b) => a.x - b.x);
const target = displays[0]; // leftmost === the external === "Display"

const json = JSON.parse(readFileSync(COLLECTION, "utf8"));
const src = (json.sources ?? []).find((s) => s.name === ZOOM_SOURCE);
if (!src) {
	console.error(`No source named "${ZOOM_SOURCE}" in the collection.`);
	process.exit(1);
}
const capW = Math.round(src?.settings?.width ?? 1920);
const capH = Math.round(src?.settings?.height ?? 1080);

const settings = {
	source: ZOOM_SOURCE,
	zoom_value: 2.0,
	zoom_speed: 0.08,
	follow: true,
	follow_speed: 0.12,
	follow_border: 8,
	follow_outside_bounds: false,
	allow_all_sources: false,
	// Manual position: the mouse arrives in GLOBAL desktop coordinates, and this
	// display sits at a negative x origin, so the script has to be told where it
	// lives. Left implicit it zooms to the wrong place.
	use_monitor_override: true,
	monitor_override_x: target.x,
	monitor_override_y: 0,
	monitor_override_w: capW || 1920,
	monitor_override_h: capH || 1080,
	monitor_override_sx: 1.0,
	monitor_override_sy: 1.0,
	monitor_override_dw: capW || 1920,
	monitor_override_dh: capH || 1080,
};

json.modules ??= {};
json.modules["scripts-tool"] ??= {};
const tool = json.modules["scripts-tool"];
tool.scripts ??= [];

const existing = tool.scripts.find((s) => s.path === LUA || /obs-zoom-to-mouse\.lua$/.test(s.path));
if (existing) {
	existing.path = LUA;
	existing.settings = { ...(existing.settings ?? {}), ...settings };
	console.log("updated the existing zoom-to-mouse registration");
} else {
	tool.scripts.push({ path: LUA, settings });
	console.log("registered zoom-to-mouse");
}

if (!existsSync(COLLECTION + ".pre-zoom")) copyFileSync(COLLECTION, COLLECTION + ".pre-zoom");
writeFileSync(COLLECTION, JSON.stringify(json, null, 4));

console.log(`  source          : ${ZOOM_SOURCE} (${capW}x${capH})`);
console.log(`  display origin  : x=${target.x} ${target.builtin ? "(built-in)" : "(external)"}`);
console.log(`  zoom / follow   : ${settings.zoom_value}x, follow ${settings.follow}`);
console.log(`\nStart OBS, then verify with:  node scripts/verify-zoom.mjs`);

function obsRunning() {
	try {
		execFileSync("/usr/bin/pgrep", ["-x", "OBS"], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}
