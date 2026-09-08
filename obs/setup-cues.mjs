#!/usr/bin/env node
/**
 * Build the two overlay cues the deck's TAKEAWAY and CHAPTER keys show, and
 * nest them (hidden) into every speaking scene. Additive and idempotent: run it
 * again and it repairs what is missing without touching what is there.
 *
 *   node obs/setup-cues.mjs            # build / repair
 *   node obs/setup-cues.mjs --dry-run  # say what would change
 *
 * Why overlays and not a stinger TRANSITION: a chapter break is usually the
 * same shot before and after, and OBS cannot transition a scene to itself. A
 * media source with alpha played OVER the current shot is the same picture to
 * the viewer, needs no target scene, and nothing has to be restored when it
 * ends — the item just goes back to hidden.
 *
 * Why nested scenes: one "Takeaway" scene and one "Chapter" scene are placed
 * as items in each speaking scene, so the banner is designed once and every
 * look shows the same one (SSOT). The key enables the item in whatever scene
 * is on program, then disables it — TAKEAWAY after ~4 s, CHAPTER when the
 * media reports it has ended.
 *
 * The takeaway TEXT lives in <record dir>/takeaway.txt, read live by the text
 * source (from_file), so the line is prepared before the take with any editor
 * or `node obs/takeaway.mjs "the line"`. The deck never carries the words.
 */
import { connect } from "./lib/obs.mjs";
import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DRY = process.argv.includes("--dry-run");
const say = (s) => console.log(s);

export const TAKEAWAY_SCENE = "Takeaway";
export const CHAPTER_SCENE = "Chapter";
const TAKEAWAY_PLATE = "Takeaway Plate";
const TAKEAWAY_TEXT = "Takeaway Text";
const CHAPTER_STING = "Chapter Sting";
const STING_FILE = resolve(fileURLToPath(new URL("./assets/chapter-sting.mov", import.meta.url)));
const MIC = "Mic";

const obs = await connect({ launch: true });
try {
	const { baseWidth: W, baseHeight: H } = await obs.call("GetVideoSettings");
	const { recordDirectory } = await obs.call("GetRecordDirectory");
	const textFile = join(recordDirectory, "takeaway.txt");

	// ---------------------------------------------------------------- scenes
	const { scenes } = await obs.call("GetSceneList");
	const have = (name) => scenes.some((s) => s.sceneName === name);
	const { inputs } = await obs.call("GetInputList");
	const haveInput = (name) => inputs.some((i) => i.inputName === name);

	if (!existsSync(STING_FILE)) throw new Error(`missing sting asset: ${STING_FILE}`);
	if (!existsSync(textFile)) {
		say(`  ${textFile}: ${DRY ? "would create" : "creating"} with a placeholder line`);
		if (!DRY) writeFileSync(textFile, "Write the takeaway here, before the take.\n");
	}

	for (const name of [TAKEAWAY_SCENE, CHAPTER_SCENE]) {
		if (!have(name)) {
			say(`  scene "${name}": ${DRY ? "would create" : "creating"}`);
			if (!DRY) await obs.call("CreateScene", { sceneName: name });
		}
	}

	// ------------------------------------------------------------- takeaway
	// A lower banner: a translucent plate across the bottom third and one line
	// of text on it. Sizes are CHOSEN starting values; Ryan's eyes on a take.
	const plateH = Math.round(H * 0.13);
	const plateY = H - plateH - Math.round(H * 0.06);
	if (!haveInput(TAKEAWAY_PLATE)) {
		say(`  ${TAKEAWAY_PLATE}: ${DRY ? "would create" : "creating"}`);
		if (!DRY) {
			await obs.call("CreateInput", {
				sceneName: TAKEAWAY_SCENE,
				inputName: TAKEAWAY_PLATE,
				inputKind: "color_source_v3",
				inputSettings: { color: 0xd90a0a0e, width: W, height: plateH },
			});
			const { sceneItemId } = await obs.call("GetSceneItemId", { sceneName: TAKEAWAY_SCENE, sourceName: TAKEAWAY_PLATE });
			await obs.call("SetSceneItemTransform", {
				sceneName: TAKEAWAY_SCENE,
				sceneItemId,
				sceneItemTransform: { positionX: 0, positionY: plateY, alignment: 5 },
			});
		}
	}
	const textSettings = {
		from_file: true,
		text_file: textFile,
		font: { face: "Helvetica Neue", size: 64, style: "Bold", flags: 0 },
		color1: 0xffffffff,
		color2: 0xffffffff,
		outline: false,
		word_wrap: true,
		custom_width: W - 160,
	};
	if (!haveInput(TAKEAWAY_TEXT)) {
		say(`  ${TAKEAWAY_TEXT}: ${DRY ? "would create" : "creating"} (reads ${textFile})`);
		if (!DRY) {
			await obs.call("CreateInput", {
				sceneName: TAKEAWAY_SCENE,
				inputName: TAKEAWAY_TEXT,
				inputKind: "text_ft2_source_v2",
				inputSettings: textSettings,
			});
			const { sceneItemId } = await obs.call("GetSceneItemId", { sceneName: TAKEAWAY_SCENE, sourceName: TAKEAWAY_TEXT });
			// Centre of the plate; alignment 0 = centre anchor.
			await obs.call("SetSceneItemTransform", {
				sceneName: TAKEAWAY_SCENE,
				sceneItemId,
				sceneItemTransform: { positionX: W / 2, positionY: plateY + plateH / 2, alignment: 0 },
			});
		}
	} else if (!DRY) {
		await obs.call("SetInputSettings", { inputName: TAKEAWAY_TEXT, inputSettings: { from_file: true, text_file: textFile } });
	}

	// -------------------------------------------------------------- chapter
	// The sting plays from its first frame every time the item is shown
	// (restart_on_activate) and releases the decoder when hidden.
	const stingSettings = {
		is_local_file: true,
		local_file: STING_FILE,
		looping: false,
		restart_on_activate: true,
		close_when_inactive: true,
		clear_on_media_end: true,
		hw_decode: false,
	};
	if (!haveInput(CHAPTER_STING)) {
		say(`  ${CHAPTER_STING}: ${DRY ? "would create" : "creating"} (${STING_FILE})`);
		if (!DRY) {
			await obs.call("CreateInput", {
				sceneName: CHAPTER_SCENE,
				inputName: CHAPTER_STING,
				inputKind: "ffmpeg_source",
				inputSettings: stingSettings,
			});
		}
	} else if (!DRY) {
		await obs.call("SetInputSettings", { inputName: CHAPTER_STING, inputSettings: stingSettings });
	}
	if (!DRY) {
		const { sceneItemId } = await obs.call("GetSceneItemId", { sceneName: CHAPTER_SCENE, sourceName: CHAPTER_STING });
		await obs.call("SetSceneItemTransform", {
			sceneName: CHAPTER_SCENE,
			sceneItemId,
			sceneItemTransform: {
				positionX: 0, positionY: 0, alignment: 5,
				boundsType: "OBS_BOUNDS_SCALE_INNER", boundsAlignment: 0, boundsWidth: W, boundsHeight: H,
			},
		});
		// The whoosh goes to the mix (1) and the apps track (4), not the mic
		// or SP isolations. Same routing setup-audio gives App Audio.
		await obs.call("SetInputAudioTracks", { inputName: CHAPTER_STING, inputAudioTracks: { 1: true, 2: false, 3: false, 4: true, 5: false, 6: false } });
	}

	// ------------------------------------------------- nest into speaking scenes
	// Speaking scenes are the ones carrying Mic (the audio repair's rule, plus
	// Cam Cutout). Idle cards never get a banner.
	const targets = [];
	for (const s of scenes) {
		if (s.sceneName === TAKEAWAY_SCENE || s.sceneName === CHAPTER_SCENE) continue;
		const { sceneItems } = await obs.call("GetSceneItemList", { sceneName: s.sceneName });
		if (s.sceneName === "Cam Cutout" || sceneItems.some((i) => i.sourceName === MIC)) targets.push({ name: s.sceneName, items: sceneItems });
	}
	say(`\nOverlay targets (${targets.length} speaking scenes): ${targets.map((t) => t.name).join(", ")}`);
	let added = 0;
	for (const t of targets) {
		for (const overlay of [TAKEAWAY_SCENE, CHAPTER_SCENE]) {
			const existing = t.items.find((i) => i.sourceName === overlay);
			if (existing) {
				if (existing.sceneItemEnabled && !DRY) {
					await obs.call("SetSceneItemEnabled", { sceneName: t.name, sceneItemId: existing.sceneItemId, sceneItemEnabled: false });
					say(`  ${t.name}: ${overlay} was left visible — hidden`);
				}
				continue;
			}
			added++;
			say(`  ${t.name}: ${DRY ? "would add" : "adding"} ${overlay} (hidden, on top)`);
			if (!DRY) {
				const { sceneItemId } = await obs.call("CreateSceneItem", { sceneName: t.name, sourceName: overlay, sceneItemEnabled: false });
				// Overlays sit above everything: index = count of items (top).
				const { sceneItems } = await obs.call("GetSceneItemList", { sceneName: t.name });
				await obs.call("SetSceneItemIndex", { sceneName: t.name, sceneItemId, sceneItemIndex: sceneItems.length - 1 });
			}
		}
	}

	// ---------------------------------------------------------------- verify
	if (!DRY) {
		const errors = [];
		for (const t of targets) {
			const { sceneItems } = await obs.call("GetSceneItemList", { sceneName: t.name });
			for (const overlay of [TAKEAWAY_SCENE, CHAPTER_SCENE]) {
				const it = sceneItems.find((i) => i.sourceName === overlay);
				if (!it) errors.push(`${t.name}: no ${overlay} item`);
				else if (it.sceneItemEnabled) errors.push(`${t.name}: ${overlay} visible at rest`);
			}
		}
		const { inputAudioTracks } = await obs.call("GetInputAudioTracks", { inputName: CHAPTER_STING });
		if (!inputAudioTracks[1] || !inputAudioTracks[4]) errors.push(`${CHAPTER_STING} not on tracks 1 and 4: ${JSON.stringify(inputAudioTracks)}`);
		if (errors.length) throw new Error(`cue verification failed: ${errors.join("; ")}`);
		say(`\nVerified: ${targets.length} speaking scenes carry both overlays hidden; sting on tracks 1+4. ${added} item(s) added.`);
	} else {
		say(`\nDry run — nothing written. ${added} item(s) would be added.`);
	}
	say(`\nTakeaway text: ${textFile}\nRyan's eyes are the verdict: press TAKEAWAY on the deck and read the banner on program.`);
} finally {
	await obs.disconnect();
}
