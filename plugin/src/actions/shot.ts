import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { execFile } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { obs } from "../obs-connection";
import { face, GLYPHS } from "../key-face";

/** SHOT — a PNG of the program scene into <record dir>/OBS Shots, then reveal it. */
@action({ UUID: "com.blessdog.obs-control-room.shot" })
export class Shot extends SingletonAction {
	private readonly log = streamDeck.logger.createScope("shot");

	constructor() {
		super();
		obs.on("connected", () => void this.render());
		obs.on("disconnected", () => void this.render());
	}

	override onWillAppear(_ev: WillAppearEvent): void {
		void this.render();
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		try {
			const dir = join((await obs.call("GetRecordDirectory")).recordDirectory, "OBS Shots");
			mkdirSync(dir, { recursive: true });
			const { currentProgramSceneName } = await obs.call("GetCurrentProgramScene");
			const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
			const imageFilePath = join(dir, `${stamp}.png`);
			await obs.call("SaveSourceScreenshot", { sourceName: currentProgramSceneName, imageFormat: "png", imageFilePath });
			execFile("/usr/bin/open", ["-R", imageFilePath]);
			this.log.info(`shot ${imageFilePath}`);
			await ev.action.showOk();
		} catch (err) {
			this.log.error(`shot failed: ${err}`);
			await ev.action.showAlert();
		}
	}

	private async render(): Promise<void> {
		const uri = face({ state: obs.connected ? "idle" : "offline", tint: "screen", glyph: GLYPHS.camera });
		for (const a of this.actions) void a.setImage(uri);
	}
}
