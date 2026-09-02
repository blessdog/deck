import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { execFile } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { obs } from "../obs-connection";
import { face, GLYPHS } from "../key-face";

/**
 * REVEAL — Finder with the newest recording selected, nothing more.
 *
 * Law (knowledge/the-deck-ends-at-the-mp4): the deck never hands a file
 * downstream. Ryan cuts several snippets together, so the unit he drags from
 * is the folder, not one file. The directory is read from OBS itself when it
 * is up (SSOT) and falls back to ~/Movies when it is not.
 */
@action({ UUID: "com.blessdog.obs-control-room.reveal" })
export class Reveal extends SingletonAction {
	private readonly log = streamDeck.logger.createScope("reveal");

	override onWillAppear(_ev: WillAppearEvent): void {
		void this.render();
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		try {
			const dir = await this.recordDirectory();
			const newest = readdirSync(dir)
				.filter((f) => /\.(mp4|mkv|mov)$/i.test(f))
				.map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
				.sort((a, b) => b.t - a.t)[0];
			const target = newest ? join(dir, newest.f) : dir;
			await new Promise<void>((res, rej) =>
				execFile("/usr/bin/open", newest ? ["-R", target] : [target], (e) => (e ? rej(e) : res())),
			);
			this.log.info(`revealed ${target}`);
			await ev.action.showOk();
		} catch (err) {
			this.log.error(`reveal failed: ${err}`);
			await ev.action.showAlert();
		}
	}

	private async recordDirectory(): Promise<string> {
		if (obs.connected) {
			try {
				return (await obs.call("GetRecordDirectory")).recordDirectory;
			} catch {
				/* fall through to the default */
			}
		}
		return join(process.env.HOME ?? "", "Movies");
	}

	private async render(): Promise<void> {
		const uri = face({ state: "idle", tint: "bracket", glyph: GLYPHS.folder });
		for (const a of this.actions) void a.setImage(uri);
	}
}
