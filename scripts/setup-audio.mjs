#!/usr/bin/env node
/**
 * Wire the three audio stems into the Control Room collection.
 *
 * The problem (2026-08-08): the collection had exactly ONE audio source —
 * `Mic`, pinned to `device_id: "default"`. So recordings carried the fifine and
 * nothing else. Two things were missing:
 *
 *   - **SP-404.** The SP-404MKII is a class-compliant USB interface and was
 *     already talking both directions (`SP-404MKII-IN` is the pads coming back
 *     into the Mac). Nothing was listening to it. It is an *input* device, so
 *     no amount of desktop-audio capture would ever have found it — that is a
 *     category boundary, not a routing mistake.
 *   - **App audio.** OBS 32 on macOS 13+ ships `sck_audio_capture`
 *     (ScreenCaptureKit) with `type: 0` = Desktop Audio Capture. That taps app
 *     render streams *before* the output device, so it works fine even though
 *     the Mac's default output is the SP-404. No BlackHole, no Loopback, no
 *     aggregate device needed on the OBS side.
 *
 * Device IDs are resolved BY NAME from OBS's own live device list rather than
 * hardcoded. A CoreAudio UID embeds the device's USB location ID, which changes
 * when it moves between hub ports, so a hardcoded UID rots.
 *
 * BOTH bindings for `Mic` can fail, so this script is the repair tool:
 *
 *   - A PINNED UID rots. The fifine re-enumerated
 *     `...fifine Microphone:2112200:2` -> `...:2120000:2` inside 90 minutes on
 *     2026-08-08. OBS's pin stopped resolving and a 23-second take came back
 *     with track 2 at flat -91 dB — digital silence, not room tone. Silent
 *     failure, discovered only by measuring the file.
 *   - `device_id: "default"` rots differently. When the fifine re-enumerated,
 *     macOS ALSO moved the default input to `MacBook Pro Microphone`. So
 *     `default` would have quietly recorded the laptop's built-in mic — a take
 *     that sounds wrong rather than one that is obviously empty. Worse.
 *
 * Resolution: PIN, and treat this script as the fix. It resolves the fifine by
 * NAME on every run, so re-running it re-pins to whatever UID the device has
 * today. It also reports when it had to repair a stale pin, so a silent
 * re-enumeration becomes a visible line of output instead of a dead track.
 * Run it as part of cold start, or any time the rig gets re-cabled.
 *
 * Track layout — track 1 is the mix you can post directly, 2/3/4 are the
 * isolated stems so Resolve never has to guess which track has the voice:
 *
 *   track 1  mix        Mic + SP-404 + App Audio
 *   track 2  mic only   fifine
 *   track 3  SP only    SP-404MKII-IN
 *   track 4  app only   ScreenCaptureKit desktop audio
 *
 * Monitoring is left OFF on every source on purpose. `App Audio` captures all
 * system audio; switching any source to "Monitor and Output" feeds OBS's own
 * monitor back into that capture and builds a feedback loop.
 *
 * MEASURED 2026-08-08, so nobody has to re-derive it:
 *
 *   - **The SP does not fold computer audio back.** With app audio playing at
 *     -6.5 dB peak on track 4, track 3 (the SP's USB return) sat at flat
 *     -91.0 dB — digital silence. So there is no double-count between the two,
 *     and nothing to change in the SP's SYSTEM > USB Audio routing.
 *   - **SoundSource conflicts, but benignly.** SoundSource's ACE and Apple's
 *     ScreenCaptureKit both tap system audio, so SoundSource offers to
 *     deactivate "to avoid doubled audio". On this rig it does NOT double:
 *     4 discrete alerts in produced exactly 4 onsets on track 4 with
 *     SoundSource active. What it does is attenuate — peak dropped -7.7 dB ->
 *     -18.2 dB. That is a healthy level on an isolated track, so leaving
 *     SoundSource active is fine. (Ruled out as a confound: system output
 *     volume isn't software-settable here, since the default output is the
 *     SP-404's USB interface.)
 *   - If SoundSource ever needs to actually SHAPE app audio during a
 *     recording, don't fight the conflict — swap `App Audio` off
 *     `sck_audio_capture` onto a `coreaudio_input_capture` pointed at a
 *     Loopback virtual device. Loopback and SoundSource are both Rogue Amoeba,
 *     share ACE, and coexist.
 *
 * Runs against a LIVE OBS — everything here goes through obs-websocket, so
 * unlike set-record-quality.mjs, OBS must be RUNNING, not quit.
 *
 *   node scripts/setup-audio.mjs [--dry-run]
 */
import { connect } from "./lib/obs.mjs";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const DRY = process.argv.includes("--dry-run");

const MIC = "Mic";
const SP = "SP-404";
const APP = "App Audio";
const LAMP = "Lava Lamp";

// Resolved by display name against OBS's live CoreAudio enumeration.
const MIC_DEVICE_NAME = "fifine Microphone";
const SP_DEVICE_NAME = "SP-404MKII-IN";

const LAMP_FILE = join(homedir(), "Movies/OBS Assets/lamp-bg.mp4");

// track number -> which sources land on it
const TRACKS = {
	[MIC]: [1, 2],
	[SP]: [1, 3],
	[APP]: [1, 4],
};
const REC_TRACKS = 15; // bitmask, tracks 1-4

const say = (s) => console.log(s);
const act = (s) => console.log(DRY ? `  [dry] ${s}` : `  ${s}`);

const obs = await connect();

// ---------------------------------------------------------------- devices
// Resolve UIDs from the device_id enum on an existing coreaudio input.
const { propertyItems } = await obs.call("GetInputPropertiesListPropertyItems", {
	inputName: MIC,
	propertyName: "device_id",
});
const byName = (name) => {
	const hit = propertyItems.find((i) => i.itemName === name);
	if (!hit) {
		const have = propertyItems.map((i) => i.itemName).join(", ");
		throw new Error(`No CoreAudio device named "${name}". Connected: ${have}`);
	}
	return hit.itemValue;
};
const micDevice = byName(MIC_DEVICE_NAME); // resolved to prove it's connected
const spDevice = byName(SP_DEVICE_NAME);

// Which device is macOS actually handing to anything asking for "default"?
const defaultInputName = (() => {
	const out = execFileSync("/usr/sbin/system_profiler", ["SPAudioDataType"], { encoding: "utf8" });
	let current = null;
	for (const line of out.split("\n")) {
		const name = line.match(/^\s{8}(\S.*):\s*$/);
		if (name) current = name[1];
		if (/Default Input Device:\s*Yes/.test(line)) return current;
	}
	return "(unknown)";
})();

say("Devices resolved:");
say(`  ${MIC_DEVICE_NAME}  ->  ${micDevice}`);
say(`  ${SP_DEVICE_NAME}  ->  ${spDevice}`);
say(`  macOS default input  ->  ${defaultInputName}`);

// ------------------------------------------------------------------ inputs
const { inputs } = await obs.call("GetInputList");
const has = (name) => inputs.some((i) => i.inputName === name);

// Where does Mic live? The new stems mirror it exactly — Mic is deliberately
// absent from the idle cards (Starting Soon, Ending) and the stems should be too.
const { scenes } = await obs.call("GetSceneList");
const micScenes = [];
for (const s of scenes) {
	const { sceneItems } = await obs.call("GetSceneItemList", { sceneName: s.sceneName });
	if (sceneItems.some((i) => i.sourceName === MIC)) micScenes.push(s.sceneName);
}
say(`\n${MIC} appears in ${micScenes.length} scenes: ${micScenes.join(", ")}`);

say("\nInputs:");

// Pin Mic by name-resolved UID; see the header for why neither binding is safe
// on its own. The interesting case is REPAIR: if the stored UID is not in the
// live device list, the mic was recording silence until this run.
const micSettings = await obs.call("GetInputSettings", { inputName: MIC });
const wasPinnedTo = micSettings.inputSettings.device_id ?? "default";
const stale = wasPinnedTo !== "default" && !propertyItems.some((i) => i.itemValue === wasPinnedTo);
if (stale) {
	say(`  !! ${MIC} was pinned to a device that no longer exists:`);
	say(`     ${wasPinnedTo}`);
	say(`     Any recording made since it moved has a SILENT mic track. Repairing.`);
}
if (wasPinnedTo !== micDevice) {
	act(`pin ${MIC} -> ${MIC_DEVICE_NAME} (was "${wasPinnedTo}")`);
	if (!DRY) await obs.call("SetInputSettings", { inputName: MIC, inputSettings: { device_id: micDevice } });
} else {
	act(`${MIC} pinned to ${MIC_DEVICE_NAME}, UID still valid`);
}
if (defaultInputName !== MIC_DEVICE_NAME) {
	say(`  note: macOS default input is "${defaultInputName}", not ${MIC_DEVICE_NAME}.`);
	say(`        Harmless for OBS now that Mic is pinned, but it is why "default" is not the fix.`);
}

async function ensureInput(name, kind, settings) {
	if (has(name)) {
		act(`${name} exists — updating settings`);
		if (!DRY) await obs.call("SetInputSettings", { inputName: name, inputSettings: settings });
		return;
	}
	act(`create ${name} (${kind}) in ${micScenes[0]}`);
	if (!DRY) {
		await obs.call("CreateInput", {
			sceneName: micScenes[0],
			inputName: name,
			inputKind: kind,
			inputSettings: settings,
			sceneItemEnabled: true,
		});
	}
}

await ensureInput(SP, "coreaudio_input_capture", { device_id: spDevice });
await ensureInput(APP, "sck_audio_capture", { type: 0 });

// Mirror Mic's placement into the remaining scenes.
say("\nScene placement:");
for (const sceneName of micScenes) {
	const { sceneItems } = await obs.call("GetSceneItemList", { sceneName });
	for (const src of [SP, APP]) {
		if (sceneItems.some((i) => i.sourceName === src)) continue;
		act(`add ${src} -> ${sceneName}`);
		if (!DRY) await obs.call("CreateSceneItem", { sceneName, sourceName: src, sceneItemEnabled: true });
	}
}

// ------------------------------------------------------------------ tracks
say("\nTrack routing:");
for (const [name, tracks] of Object.entries(TRACKS)) {
	const map = Object.fromEntries([1, 2, 3, 4, 5, 6].map((t) => [String(t), tracks.includes(t)]));
	act(`${name} -> tracks ${tracks.join(" + ")}`);
	if (!DRY) await obs.call("SetInputAudioTracks", { inputName: name, inputAudioTracks: map });
	// Monitoring off: App Audio captures system audio, so monitoring feeds back.
	if (!DRY) {
		await obs.call("SetInputAudioMonitorType", {
			inputName: name,
			monitorType: "OBS_MONITORING_TYPE_NONE",
		});
	}
}

const recBefore = (await obs.call("GetProfileParameter", {
	parameterCategory: "AdvOut",
	parameterName: "RecTracks",
})).parameterValue;
act(`AdvOut.RecTracks ${recBefore} -> ${REC_TRACKS} (records tracks 1-4)`);
if (!DRY) {
	await obs.call("SetProfileParameter", {
		parameterCategory: "AdvOut",
		parameterName: "RecTracks",
		parameterValue: String(REC_TRACKS),
	});
}

// -------------------------------------------------------------------- lamp
say("\nLava Lamp:");
const lampNow = await obs.call("GetInputSettings", { inputName: LAMP });
const lampPath = lampNow.inputSettings.local_file;
if (!existsSync(LAMP_FILE)) {
	act(`SKIPPED — ${LAMP_FILE} does not exist`);
} else if (lampPath === LAMP_FILE) {
	act("already points at the stable path");
} else {
	act(`repoint: ${lampPath}`);
	act(`      -> ${LAMP_FILE}`);
	if (!DRY) await obs.call("SetInputSettings", { inputName: LAMP, inputSettings: { local_file: LAMP_FILE } });
}

// ------------------------------------------------------------------ verify
// Doctrine: never trust your own last write. Re-query everything.
say("\n--- VERIFY (re-queried from OBS) ---");
const { inputs: after } = await obs.call("GetInputList");
for (const name of [MIC, SP, APP]) {
	if (!after.some((i) => i.inputName === name)) {
		say(`  ${name}: MISSING`);
		continue;
	}
	const s = await obs.call("GetInputSettings", { inputName: name });
	const t = await obs.call("GetInputAudioTracks", { inputName: name });
	const m = await obs.call("GetInputAudioMonitorType", { inputName: name });
	const on = Object.entries(t.inputAudioTracks)
		.filter(([, v]) => v)
		.map(([k]) => k)
		.join("+");
	const dev = s.inputSettings.device_id ?? `type=${s.inputSettings.type ?? 0}`;
	say(`  ${name.padEnd(10)} tracks ${on.padEnd(8)} monitor=${m.monitorType.replace("OBS_MONITORING_TYPE_", "")}  ${dev}`);
}
const recAfter = (await obs.call("GetProfileParameter", {
	parameterCategory: "AdvOut",
	parameterName: "RecTracks",
})).parameterValue;
const lampAfter = await obs.call("GetInputSettings", { inputName: LAMP });
say(`  RecTracks  ${recAfter}`);
say(`  ${LAMP}  ${lampAfter.inputSettings.local_file}`);

for (const sceneName of micScenes) {
	const { sceneItems } = await obs.call("GetSceneItemList", { sceneName });
	const names = sceneItems.map((i) => i.sourceName);
	const missing = [MIC, SP, APP].filter((n) => !names.includes(n));
	if (missing.length) say(`  ${sceneName}: MISSING ${missing.join(", ")}`);
}

await obs.disconnect();

say(`\n${DRY ? "Dry run — nothing written." : "Done."}`);
say(`
Ryan's eyes are the verdict. In OBS, watch the Audio Mixer:

  1. Hit a pad on the SP-404      -> only "SP-404" should move
  2. Play a YouTube video          -> only "App Audio" should move
  3. Talk                          -> only "Mic" should move

If step 2 ALSO moves the SP-404 meter, the SP is folding computer audio back
up its USB return. Fix that in the SP's SYSTEM > USB Audio routing, or app
audio lands on two tracks and double-counts in the mix.`);
