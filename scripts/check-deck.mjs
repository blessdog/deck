#!/usr/bin/env node
/**
 * THE TRIPWIRE. Compares the physical deck's profile against the plugin that
 * is actually installed, and fails loudly on the two ways they drift apart:
 *
 *   1. ORPHANED KEY  — a key is assigned to an action the plugin no longer
 *      ships. The Stream Deck app draws a yellow warning triangle. This is
 *      exactly what happened by 2026-08-01: five keys (show-flow, screen-picker,
 *      pause-record, scene-screen, stream) had been deleted from the source
 *      weeks earlier and nobody noticed, because the logs only ever said
 *      "Connected to OBS".
 *   2. UNPLACED ACTION — the plugin ships an action that sits on no key
 *      anywhere. Screen L / Screen R were built, committed, and unreachable.
 *
 * Run it after every build. Exit code 1 means the deck is lying to you.
 *
 *   node scripts/check-deck.mjs
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { PLUGIN } from "./deck-layout.mjs";

const SD = join(homedir(), "Library/Application Support/com.elgato.StreamDeck");
const PROFILES = join(SD, "ProfilesV3");
const MANIFEST = join(SD, "Plugins", `${PLUGIN}.sdPlugin`, "manifest.json");

const shipped = new Set(
	JSON.parse(readFileSync(MANIFEST, "utf8")).Actions.map((a) => a.UUID),
);

/** Case-insensitive lookup — profile dirs are upper-case, manifests lower. */
const findDir = (parent, name) =>
	readdirSync(parent).find((d) => d.toLowerCase() === name.toLowerCase());

const orphans = [];
const placed = new Set();
let pagesSeen = 0;

for (const bundle of readdirSync(PROFILES).filter((d) => d.endsWith(".sdProfile"))) {
	const root = join(PROFILES, bundle);
	const top = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
	for (const pageId of top.Pages?.Pages ?? []) {
		const dir = findDir(join(root, "Profiles"), pageId);
		if (!dir) continue;
		const file = join(root, "Profiles", dir, "manifest.json");
		if (!existsSync(file)) continue;
		pagesSeen++;
		const page = JSON.parse(readFileSync(file, "utf8"));
		for (const ctrl of page.Controllers ?? []) {
			for (const [coord, act] of Object.entries(ctrl.Actions ?? {})) {
				const uuid = act?.UUID;
				if (!uuid?.startsWith(PLUGIN)) continue; // not ours to police
				if (shipped.has(uuid)) placed.add(uuid);
				else
					orphans.push({
						profile: top.Name,
						device: top.Device?.Model,
						coord,
						uuid,
					});
			}
		}
	}
}

const unplaced = [...shipped].filter((u) => !placed.has(u));

console.log(`checked ${pagesSeen} pages · plugin ships ${shipped.size} actions`);

if (orphans.length) {
	console.error(`\n✖ ${orphans.length} ORPHANED KEY(S) — these show a warning triangle:`);
	for (const o of orphans)
		console.error(`    ${o.profile} [${o.device}] key ${o.coord} → ${o.uuid}`);
}
if (unplaced.length) {
	console.error(`\n✖ ${unplaced.length} ACTION(S) ON NO KEY — shipped but unreachable:`);
	for (const u of unplaced) console.error(`    ${u}`);
}

if (orphans.length || unplaced.length) {
	console.error("\nFix: edit scripts/deck-layout.mjs, then run scripts/build-profile.mjs\n");
	process.exit(1);
}
console.log("✓ every key resolves, every action is reachable");
