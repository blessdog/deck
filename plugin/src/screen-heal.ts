import streamDeck from "@elgato/streamdeck";
import { obs, sleep } from "./obs-connection";

/**
 * Rebuild every macOS Screen Capture stream in OBS.
 *
 * MECHANISM (measured 2026-09-03): after a night of sleep/wake cycles OBS's
 * ScreenCaptureKit streams delivered the desktop wallpaper only — no windows —
 * while every permission read "granted". Re-applying identical settings is a
 * no-op; pointing each source at another display and back forces a new stream
 * and both screens came back clean (Screen L 81 → 3.3 against the OS's own
 * capture). Ryan, the same morning: "This is a known failure bug that keeps
 * returning over and over." It returns because nothing rebuilt the stream;
 * this does, on every OBS connect and every system wake, so he never records
 * eight minutes of wallpaper again.
 *
 * Mirror of obs/heal-screens.mjs, on the plugin's own connection.
 */
const log = streamDeck.logger.createScope("screen-heal");
let healing = false;

export async function healScreens(): Promise<number> {
	if (healing || !obs.connected) return 0;
	healing = true;
	try {
		const { inputs } = await obs.call("GetInputList", { inputKind: "screen_capture" });
		if (!inputs.length) return 0;
		const uuids = obs.displayUUIDs().map((d) => d.uuid);
		const originals: { inputName: string; current: string }[] = [];
		for (const { inputName } of inputs as { inputName: string }[]) {
			const { inputSettings } = await obs.call("GetInputSettings", { inputName });
			const current = inputSettings.display_uuid as string;
			const other = uuids.find((u) => u !== current) ?? current;
			originals.push({ inputName, current });
			await obs.call("SetInputSettings", { inputName, inputSettings: { display_uuid: other } });
		}
		await sleep(2000);
		for (const { inputName, current } of originals) {
			await obs.call("SetInputSettings", { inputName, inputSettings: { display_uuid: current } });
		}
		log.info(`rebuilt ${originals.length} screen capture stream(s)`);
		return originals.length;
	} catch (err) {
		log.warn(`heal failed: ${err}`);
		return 0;
	} finally {
		healing = false;
	}
}

/** Wire the heal to every OBS connect and every system wake. */
export function installScreenHeal(): void {
	obs.on("connected", () => void sleep(3000).then(healScreens));
	streamDeck.system.onSystemDidWakeUp(() => void sleep(5000).then(healScreens));
}
