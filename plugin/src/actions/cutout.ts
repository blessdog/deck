import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { cutout } from "../cutout";
import { obs } from "../obs-connection";
import { face, GLYPHS } from "../key-face";

/**
 * CUTOUT — a latch, not a scene. Press: the room disappears around Ryan in
 * whatever shot is up; press again: it is back. Ryan, 2026-09-08: "hit cutout
 * in whatever scene I'm in, and it cuts out the background. Just has me
 * free-floating in it." The old scene key is in archive/scene-cam-cutout-key.
 *
 * Whole key lit while the latch is on, as with every state face. Pressed on a
 * screen-only scene it arms with nothing to show until a camera scene goes up
 * — that is the latch working, not a dead key. With OBS down: dim + alert.
 */
@action({ UUID: "com.blessdog.obs-control-room.cutout" })
export class Cutout extends SingletonAction {
	private readonly log = streamDeck.logger.createScope("cutout-key");

	constructor() {
		super();
		obs.on("connected", () => void this.render());
		obs.on("disconnected", () => void this.render());
		cutout.on("changed", () => void this.render());
	}

	override onWillAppear(_ev: WillAppearEvent): void {
		void cutout.refresh();
		void this.render();
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		if (!obs.connected) {
			await ev.action.showAlert();
			return;
		}
		try {
			await cutout.toggle();
		} catch (err) {
			this.log.error(`cutout toggle failed: ${err}`);
			await ev.action.showAlert();
		}
		void this.render();
	}

	private async render(): Promise<void> {
		const uri = face({
			state: !obs.connected ? "offline" : cutout.active ? "active" : "idle",
			tint: "camera",
			glyph: GLYPHS.person,
			label: "CUTOUT",
		});
		for (const a of this.actions) void a.setImage(uri);
	}
}
