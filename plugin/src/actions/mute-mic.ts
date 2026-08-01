import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { obs } from "../obs-connection";
import { face, GLYPHS } from "../key-face";

const MIC = "Mic"; // the one shared mic input across every Control Room scene

/**
 * Honest mic mute on one key: press toggles the shared Mic input; the face
 * follows OBS's own mute event, so it can never lie. Red slashed mic =
 * muted, white open mic = hot. With OBS down there is nothing to mute —
 * dim + alert.
 */
@action({ UUID: "com.blessdog.obs-control-room.mute-mic" })
export class MuteMic extends SingletonAction {
	private muted = false;

	constructor() {
		super();
		obs.on("connected", () => void this.refresh());
		obs.on("disconnected", () => void this.render());
		obs.on("InputMuteStateChanged", ({ inputName, inputMuted }) => {
			if (inputName !== MIC) return;
			this.muted = inputMuted;
			void this.render();
		});
	}

	override onWillAppear(_ev: WillAppearEvent): void {
		void this.refresh();
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		if (!obs.connected) {
			await ev.action.showAlert();
			return;
		}
		try {
			this.muted = (await obs.call("ToggleInputMute", { inputName: MIC })).inputMuted;
			void this.render();
		} catch {
			await ev.action.showAlert();
		}
	}

	private async refresh(): Promise<void> {
		if (obs.connected) {
			try {
				this.muted = (await obs.call("GetInputMute", { inputName: MIC })).inputMuted;
			} catch {
				/* keep last known */
			}
		}
		void this.render();
	}

	private async render(): Promise<void> {
		// Muted is the state that ruins a take, so it gets the loud tile: the
		// whole key goes amber with a slashed mic. Hot mic is the quiet default.
		const uri = face({
			state: !obs.connected ? "offline" : this.muted ? "alert" : "idle",
			tint: "mic",
			glyph: this.muted ? GLYPHS.micMuted : GLYPHS.mic,
		});
		for (const a of this.actions) void a.setImage(uri);
	}
}
