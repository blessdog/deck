import {
	action,
	KeyDownEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";
import { obs } from "../obs-connection";
import { KeyAnimator } from "../animator";
import { recordFace } from "../key-face";

// Slow breath: ~7 fps is plenty for a pulse and kind to the shared USB pipe.
const PULSE_MS = 150;

/**
 * Corpus recording on one key. Idle it's a plain circle (white ready, dim when
 * OBS is down); the instant it's rolling it becomes a living red blob that
 * breathes, elapsed time underneath — so a glance says "yes, this is recording".
 * Press toggles start/stop, cold-starting OBS first if it's dead. Recordings
 * land in ~/Movies untouched; processing is a separate, later act.
 */
@action({ UUID: "com.blessdog.obs-control-room.record" })
export class Record extends SingletonAction {
	private recording = false;
	// Date.now() at record start, so elapsed is computed locally each frame
	// instead of hammering OBS with GetRecordStatus every 150ms.
	private startedAtMs = 0;
	private visible = 0;

	private readonly pulse = new KeyAnimator(
		(t) => recordFace({ connected: true, recording: true, t, elapsedMs: Date.now() - this.startedAtMs }),
		(uri) => this.broadcast(uri),
		PULSE_MS,
	);

	constructor() {
		super();
		obs.on("connected", () => void this.refresh());
		obs.on("disconnected", () => {
			this.recording = false;
			this.pulse.stop();
			this.renderStatic();
		});
		obs.on("RecordStateChanged", () => void this.refresh());
	}

	override onWillAppear(_ev: WillAppearEvent): void {
		this.visible++;
		void this.refresh();
	}

	override onWillDisappear(_ev: WillDisappearEvent): void {
		if (--this.visible <= 0) {
			this.visible = 0;
			this.pulse.stop(); // never animate a key nobody can see
		}
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		try {
			if (!obs.connected) {
				await ev.action.setImage(recordFace({ connected: false, recording: false, note: "starting OBS" }));
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
			this.renderStatic();
		}
	}

	private async refresh(): Promise<void> {
		if (obs.connected) {
			try {
				const s = await obs.call("GetRecordStatus");
				this.startedAtMs = Date.now() - (s.outputDuration ?? 0);
				this.apply(s.outputActive);
				return;
			} catch {
				/* keep last known */
			}
		}
		this.renderStatic();
	}

	private apply(active: boolean): void {
		this.recording = active;
		if (active) {
			if (this.visible > 0) this.pulse.play(); // idempotent
		} else {
			this.pulse.stop();
			this.renderStatic();
		}
	}

	private renderStatic(): void {
		this.broadcast(recordFace({ connected: obs.connected, recording: false }));
	}

	private broadcast(uri: string): void {
		for (const a of this.actions) void a.setImage(uri);
	}
}
