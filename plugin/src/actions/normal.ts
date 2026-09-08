import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { cues } from "../cues";
import { obs } from "../obs-connection";
import { face, GLYPHS } from "../key-face";

/**
 * NORMAL — the way out of any cue. Restores the shot and transition that were
 * saved when the cue began, and forgets the cue. It never starts or stops a
 * recording and never touches the mic: only cue-owned state is restored.
 *
 * Lit only while a cue holds the program. Dim means pressing does nothing,
 * and that is the honest face — there is no "normal" to go back to.
 */
@action({ UUID: "com.blessdog.obs-control-room.normal" })
export class Normal extends SingletonAction {
	private readonly log = streamDeck.logger.createScope("normal");

	constructor() {
		super();
		obs.on("connected", () => void this.render());
		obs.on("disconnected", () => void this.render());
		cues.on("changed", () => void this.render());
	}

	override onWillAppear(_ev: WillAppearEvent): void {
		void this.render();
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		if (!obs.connected || !cues.active) {
			await ev.action.showAlert();
			return;
		}
		try {
			const restored = await cues.restore("normal pressed");
			if (restored) await ev.action.showOk();
		} catch (err) {
			this.log.error(`normal failed: ${err}`);
			await ev.action.showAlert();
		}
		void this.render();
	}

	private async render(): Promise<void> {
		const uri = face({ state: obs.connected && cues.active ? "idle" : "offline", tint: "camera", glyph: GLYPHS.house });
		for (const a of this.actions) void a.setImage(uri);
	}
}
