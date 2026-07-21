import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { obs } from "../obs-connection";
import { COLORS, face, fmtDuration, GLYPHS } from "../key-face";

/**
 * Corpus recording on one key: press toggles the OBS recording
 * (cold-starting OBS first if it's dead). The face is honest — dim circle
 * when idle, amber circle + elapsed time while recording, offline look
 * when OBS is down. Recordings land in ~/Movies untouched; processing is
 * a separate, later act (media-studio corpus doctrine).
 */
@action({ UUID: "com.blessdog.obs-control-room.record" })
export class Record extends SingletonAction {
	private recording = false;
	private timer: NodeJS.Timeout | undefined;

	constructor() {
		super();
		obs.on("connected", () => void this.refresh());
		obs.on("disconnected", () => {
			this.recording = false;
			this.stopTimer();
			void this.render();
		});
		obs.on("RecordStateChanged", ({ outputActive }) => {
			this.recording = outputActive;
			if (outputActive) this.startTimer();
			else this.stopTimer();
			void this.render();
		});
	}

	override onWillAppear(_ev: WillAppearEvent): void {
		void this.refresh();
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		try {
			if (!obs.connected) {
				await ev.action.setImage(
					face({ tag: "REC", glyph: GLYPHS.record, sub: "starting OBS…", color: COLORS.ready }),
				);
				await obs.ensureOBS();
			}
			if (this.recording) {
				await obs.call("StopRecord");
				await ev.action.showOk();
			} else {
				await obs.call("StartRecord");
			}
		} catch {
			await ev.action.showAlert();
			void this.render();
		}
	}

	private async refresh(): Promise<void> {
		if (obs.connected) {
			try {
				this.recording = (await obs.call("GetRecordStatus")).outputActive;
			} catch {
				/* keep last known */
			}
		}
		if (this.recording) this.startTimer();
		else this.stopTimer();
		void this.render();
	}

	private async render(): Promise<void> {
		let elapsed: string | undefined;
		if (this.recording) {
			try {
				elapsed = fmtDuration((await obs.call("GetRecordStatus")).outputDuration);
			} catch {
				/* face still shows recording state */
			}
		}
		const uri = face({
			tag: "REC",
			glyph: GLYPHS.record,
			sub: !obs.connected ? "OBS off · press" : this.recording ? elapsed : "press to record",
			color: !obs.connected ? COLORS.offline : this.recording ? COLORS.rec : COLORS.ready,
		});
		for (const a of this.actions) void a.setImage(uri);
	}

	private startTimer(): void {
		this.timer ??= setInterval(() => void this.render(), 1_000);
	}

	private stopTimer(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
	}
}
