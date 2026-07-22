import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { obs } from "../obs-connection";
import { COLORS, face, GLYPHS } from "../key-face";

/**
 * Pause/resume the rolling recording — OBS holds its breath and keeps
 * writing the SAME file on resume, so the corpus stays one recording. The
 * face always shows the NEXT action: pause bars while rolling, an amber
 * play triangle while paused (the elapsed timer lives on the Record key).
 * Meaningless when not recording: dim + alert, same grammar as Mark.
 */
@action({ UUID: "com.blessdog.obs-control-room.pause-record" })
export class PauseRecord extends SingletonAction {
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
		// Fires on start/stop AND pause/resume; refresh reads the full truth.
		obs.on("RecordStateChanged", () => void this.refresh());
	}

	override onWillAppear(_ev: WillAppearEvent): void {
		void this.refresh();
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		if (!this.recording) {
			await ev.action.showAlert(); // nothing rolling, nothing to pause
			return;
		}
		try {
			await obs.call("ToggleRecordPause");
			await this.refresh();
		} catch {
			await ev.action.showAlert();
			void this.render();
		}
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
			glyph: this.paused ? GLYPHS.play : GLYPHS.pause,
			color: !this.recording ? COLORS.offline : this.paused ? COLORS.rec : COLORS.ready,
		});
		for (const a of this.actions) void a.setImage(uri);
	}
}
