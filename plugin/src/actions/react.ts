import { action, KeyDownEvent, KeyUpEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { cues } from "../cues";
import { obs, SCENES } from "../obs-connection";
import { face, GLYPHS, KeyState } from "../key-face";

/**
 * REACT — hold for the closer camera shot, release to return to the shot you
 * were on. A momentary key, like push-to-talk: the reaction lasts exactly as
 * long as the thumb does, so there is nothing to remember to undo.
 *
 * The closer shot is the "React" scene (obs/add-look.mjs react): the SAME
 * shared Camera input scaled past the canvas. Same source in both scenes is
 * what the Move transition matches on, so the punch-in slides rather than
 * cuts, and the camera ISO keeps recording untouched.
 *
 * The saved shot lives in cues.ts, not here, so NORMAL can cancel it and so a
 * scene key pressed mid-hold ends the reaction instead of being dragged back
 * on release. Two edges this key must survive:
 *
 *   - a FAST TAP: key-up can arrive before key-down's capture round-trip has
 *     returned. Key-up awaits the key-down promise before restoring, so a tap
 *     never strands the program on the close-up.
 *   - key-up with nothing held (plugin restarted mid-hold, OBS down): a no-op.
 */
@action({ UUID: "com.blessdog.obs-control-room.react" })
export class React extends SingletonAction {
	private readonly log = streamDeck.logger.createScope("react");
	private pending: Promise<void> | undefined;

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
			// A reaction needs a program to react on; launching OBS during a
			// hold makes no sense, unlike the scene keys.
			await ev.action.showAlert();
			return;
		}
		this.pending = (async () => {
			await cues.begin("react", SCENES.react);
		})();
		try {
			await this.pending;
		} catch (err) {
			this.log.error(`react failed: ${err}`);
			this.pending = undefined;
			await ev.action.showAlert();
			void this.render();
		}
	}

	override async onKeyUp(_ev: KeyUpEvent): Promise<void> {
		const pending = this.pending;
		this.pending = undefined;
		if (!pending) return;
		try {
			await pending;
		} catch {
			return; // key-down already reported it
		}
		try {
			await cues.restore("react released");
		} catch (err) {
			this.log.error(`restore failed: ${err}`);
		}
		void this.render();
	}

	private async render(): Promise<void> {
		const state: KeyState = !obs.connected ? "offline" : cues.active?.owner === "react" ? "active" : "idle";
		const uri = face({ state, tint: "camera", glyph: GLYPHS.react });
		for (const a of this.actions) void a.setImage(uri);
	}
}
