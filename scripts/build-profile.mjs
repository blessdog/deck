#!/usr/bin/env node
/**
 * Writes the XL page from `deck-layout.mjs`, so the layout lives in git instead
 * of only inside the Stream Deck app's database.
 *
 * The app owns these files while it runs and rewrites them on quit, so this
 * QUITS the app, edits, and relaunches. It preserves any key that isn't ours —
 * notably the page-navigation key, which the app places itself and refuses to
 * let you delete.
 *
 *   node scripts/build-profile.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { DEVICES, PLUGIN, nameOf, placements, uuidOf } from "./deck-layout.mjs";

const DRY = process.argv.includes("--dry");
const SD = join(homedir(), "Library/Application Support/com.elgato.StreamDeck");
const PROFILES = join(SD, "ProfilesV3");
const APP = "/Applications/Elgato Stream Deck.app";

const pluginManifest = JSON.parse(
	readFileSync(join(SD, "Plugins", `${PLUGIN}.sdPlugin`, "manifest.json"), "utf8"),
);
const PLUGIN_VERSION = pluginManifest.Version;
const PLUGIN_NAME = pluginManifest.Name;
const shipped = new Set(pluginManifest.Actions.map((a) => a.UUID));

const findDir = (parent, name) =>
	readdirSync(parent).find((d) => d.toLowerCase() === name.toLowerCase());

/**
 * Locate one target per (device, page) we describe.
 *
 * Pages are taken in `top.Pages.Pages` order and matched positionally against
 * `dev.pages`, so page 1 is the OBS surface and page 2 is rectum. A profile may
 * hold MORE pages than we describe — those are skipped entirely rather than
 * blanked, on the same principle that keeps foreign keys: other tools own them.
 */
function targets() {
	const found = [];
	for (const bundle of readdirSync(PROFILES).filter((d) => d.endsWith(".sdProfile"))) {
		const root = join(PROFILES, bundle);
		const top = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
		const dev = DEVICES[top.Device?.Model];
		if (!dev) continue;
		// A device can own several profiles (Ryan's Stream Deck + also carries
		// two Voicemod "Starter" profiles). Only ever touch the default one —
		// other profiles belong to other tools and are none of our business.
		if (top.Name !== "Default Profile") continue;

		const layouts = dev.pages ?? [dev.layout];
		const pageIds = top.Pages?.Pages ?? [top.Pages?.Current];
		layouts.forEach((layout, index) => {
			const pageId = pageIds[index];
			if (!pageId) {
				console.warn(
					`  ! ${dev.name}: layout page ${index + 1} has no profile page. ` +
						`Add a page in the Stream Deck app, then re-run.`,
				);
				return;
			}
			const dir = findDir(join(root, "Profiles"), pageId);
			if (!dir) return;
			found.push({
				dev, top, layout,
				pageLabel: `page ${index + 1}`,
				file: join(root, "Profiles", dir, "manifest.json"),
			});
		});
	}
	return found;
}

const found = targets();
if (found.length === 0) {
	console.error("No known device profile found. Is the XL paired?");
	process.exit(1);
}

// The app rewrites these files from memory when it exits, so any edit made
// while it runs is silently discarded. Quit first — this was the whole reason
// the Companion-era config work kept "succeeding" with no visible effect.
const wasRunning = !DRY && isRunning();
if (wasRunning) {
	// The app must be QUIT, not killed. It holds the profile in memory and
	// rewrites these files on exit, so editing underneath a running app is
	// silently discarded — and a SIGTERM'd app skips its session checkpoint,
	// so the next launch pops "detected an error restoring the last session"
	// and offers to roll back to a stale backup. Both learned the hard way,
	// 2026-08-01. AppleScript is the only clean quit; it needs a one-time
	// Automation permission grant, so if it's refused we stop and ask rather
	// than reaching for pkill.
	console.log("quitting Stream Deck app…");
	try {
		execFileSync("/usr/bin/osascript", ["-e", 'tell application "Elgato Stream Deck" to quit'], {
			stdio: "ignore",
		});
	} catch {
		console.error(
			"\nCouldn't quit the Stream Deck app automatically.\n" +
				"macOS needs one-time permission: System Settings → Privacy & Security →\n" +
				"Automation → allow your terminal to control 'Elgato Stream Deck'.\n" +
				"Or just quit the Stream Deck app yourself, then re-run this.\n" +
				"(Do NOT force-kill it — that triggers the 'restore last session' prompt,\n" +
				" and accepting that prompt reverts this layout.)\n",
		);
		process.exit(1);
	}
	for (let i = 0; i < 60 && isRunning(); i++) execFileSync("/bin/sleep", ["0.25"]);
	if (isRunning()) {
		console.error("Stream Deck app is still running — quit it by hand and re-run.");
		process.exit(1);
	}
	execFileSync("/bin/sleep", ["1"]); // let it finish flushing its own writes
}

for (const { dev, top, file, layout, pageLabel } of found) {
	const page = JSON.parse(readFileSync(file, "utf8"));
	const keypad = (page.Controllers ?? []).find((c) => c.Type === "Keypad") ?? page.Controllers?.[0];
	if (!keypad) {
		console.error(`no keypad controller in ${file}`);
		continue;
	}
	const before = keypad.Actions ?? {};

	// Keep every key that isn't ours (the app's page-nav key lives here and
	// cannot be removed), drop all of ours, then lay ours out fresh.
	const next = {};
	for (const [coord, act] of Object.entries(before)) {
		if (!act?.UUID?.startsWith(PLUGIN)) next[coord] = act;
	}

	const missing = [];
	for (const { coord, short } of placements(layout)) {
		const uuid = uuidOf(short);
		if (!shipped.has(uuid)) {
			missing.push(`${coord} → ${uuid}`);
			continue;
		}
		if (next[coord]) {
			console.warn(`  ! ${coord} is held by ${next[coord].UUID} — skipping ${short}`);
			continue;
		}
		const prior = before[coord];
		next[coord] = {
			ActionID: prior?.UUID === uuid ? prior.ActionID : randomUUID(),
			LinkedTitle: true,
			Name: nameOf(short),
			Plugin: { Name: PLUGIN_NAME, UUID: PLUGIN, Version: PLUGIN_VERSION },
			Resources: null,
			Settings: {},
			State: 0,
			States: [{}],
			UUID: uuid,
		};
	}

	if (missing.length) {
		console.error(`✖ layout references actions the plugin does not ship:`);
		for (const m of missing) console.error(`    ${m}`);
		process.exit(1);
	}

	const ours = Object.values(next).filter((a) => a.UUID.startsWith(PLUGIN)).length;
	console.log(`${dev.name} "${top.Name}" ${pageLabel} → ${ours} keys (+${Object.keys(next).length - ours} foreign kept)`);

	if (DRY) continue;
	if (!existsSync(file + ".bak")) copyFileSync(file, file + ".bak");
	keypad.Actions = next;
	writeFileSync(file, JSON.stringify(page, null, 2));
}

if (!DRY && wasRunning) {
	console.log("relaunching Stream Deck app…");
	execFileSync("/usr/bin/open", ["-a", APP]);
}
console.log(DRY ? "(dry run — nothing written)" : "done");

function isRunning() {
	try {
		execFileSync("/usr/bin/pgrep", ["-f", "Elgato Stream Deck"], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}
