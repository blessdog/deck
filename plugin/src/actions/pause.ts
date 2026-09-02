import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obs } from "../obs-connection";
import { face, GLYPHS } from "../key-face";

/**
 * PAUSE — pause/resume the running recording. Dim when nothing is recording.
 *
 * Never acts on remembered state (Record-key doctrine, 2026-08-01): the press
 * re-reads GetRecordStatus, and the face follows RecordStateChanged
 * (OBS_WEBSOCKET_OUTPUT_PAUSED / RESUMED / STOPPED).
 */
@action({ UUID: "com.blessdog.obs-control-room.pause" })
export class Pause extends SingletonAction {
	private readonly log = streamDeck.logger.createScope("pause");
	private recording = false;
	private paused = false;

	constructor() {
		super();
		obs.on("connected", () => void this.refresh());
		obs.on("disconnected", () => {
			this.recording = false;
			this.paused = false;
			void this.render();
		});
		obs.on("RecordStateChanged", ({ outputActive, outputState }) => {
			this.recording = outputActive;
			if (outputState === "OBS_WEBSOCKET_OUTPUT_PAUSED") this.paused = true;
			if (outputState === "OBS_WEBSOCKET_OUTPUT_RESUMED" || outputState === "OBS_WEBSOCKET_OUTPUT_STOPPED") this.paused = false;
			void this.render();
		});
	}

	override onWillAppear(_ev: WillAppearEvent): void {
		void this.refresh();
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		try {
			const s = await obs.call("GetRecordStatus");
			if (!s.outputActive) {
				await ev.action.showAlert(); // nothing to pause
				return;
			}
			await obs.call("ToggleRecordPause");
			await ev.action.showOk();
		} catch (err) {
			this.log.error(`pause failed: ${err}`);
			await ev.action.showAlert();
		}
		void this.refresh();
	}

	private async refresh(): Promise<void> {
		if (obs.connected) {
			try {
				const s = await obs.call("GetRecordStatus");
				this.recording = s.outputActive;
				this.paused = s.outputPaused;
			} catch {
				/* keep last known */
			}
		}
		void this.render();
	}

	private async render(): Promise<void> {
		const uri = face({
			state: !this.recording ? "offline" : this.paused ? "alert" : "idle",
			tint: "live",
			glyph: this.paused ? GLYPHS.play : GLYPHS.pause,
			sub: this.paused ? "paused" : undefined,
		});
		for (const a of this.actions) void a.setImage(uri);
	}
}
