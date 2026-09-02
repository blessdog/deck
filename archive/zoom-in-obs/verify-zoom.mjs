#!/usr/bin/env node
/**
 * Ground-truth that the zoom script actually loaded, rather than trusting that
 * writing the config was enough. If the lua fails to load, OBS says nothing and
 * the deck key would fire into the void — the exact failure mode this project
 * keeps tripping over.
 *
 *   node scripts/verify-zoom.mjs
 */
import { connect } from "./lib/obs.mjs";

const WANT = ["toggle_zoom_hotkey", "toggle_follow_hotkey"];

const obs = await connect({ launch: true });
try {
	const { hotkeys } = await obs.call("GetHotkeyList");
	const missing = WANT.filter((h) => !hotkeys.includes(h));
	if (missing.length) {
		console.error(`✖ zoom script is NOT loaded — missing hotkeys: ${missing.join(", ")}`);
		console.error(`  OBS → Tools → Scripts should list vendor/obs-zoom-to-mouse.lua.`);
		console.error(`  If it's listed with an error, check the Script Log there.`);
		process.exit(1);
	}
	console.log(`✓ zoom script loaded — hotkeys registered: ${WANT.join(", ")}`);
	console.log(`  the deck's ZOOM key fires TriggerHotkeyByName("toggle_zoom_hotkey")`);
} finally {
	await obs.disconnect();
}
