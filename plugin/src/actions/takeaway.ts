import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { cues } from "../cues";
import { obs, SCENES } from "../obs-connection";
import { face, GLYPHS, KeyState } from "../key-face";

/** How long the banner stays up. CHOSEN starting value from the plan; tune on a finished take. */
const HOLD_MS = 4_000;

/**
 * TAKEAWAY — show the lower banner over the current shot for a few seconds,
 * then take it down. The words come from <record dir>/takeaway.txt, read live
 * by the OBS text source, so the line is prepared before the take and the deck
 * never carries text. A second press while the banner is up restarts the hold
 * rather than stacking; NORMAL takes it down early.
 *
 * The banner is a nested "Takeaway" scene item that obs/setup-cues.mjs places
 * hidden in every speaking scene; the key enables the item in whatever scene
 * is on program. A scene with no such item (a title card) alerts.
 */
@action({ UUID: "com.blessdog.obs-control-room.takeaway" })
export class Takeaway extends SingletonAction {
	private readonly log = streamDeck.logger.createScope("takeaway");

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
		if (!obs.connected) {
			await ev.action.showAlert();
			return;
		}
		try {
			await cues.showOverlay("takeaway", SCENES.takeaway, HOLD_MS);
		} catch (err) {
			this.log.error(`takeaway failed: ${err}`);
			await ev.action.showAlert();
		}
		void this.render();
	}

	private async render(): Promise<void> {
		const state: KeyState = !obs.connected ? "offline" : cues.overlayActive("takeaway") ? "active" : "idle";
		const uri = face({ state, tint: "mark", glyph: GLYPHS.takeaway });
		for (const a of this.actions) void a.setImage(uri);
	}
}
