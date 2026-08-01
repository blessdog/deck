import {
	action,
	KeyDownEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obs } from "../obs-connection";
import { KeyAnimator } from "../animator";
import { recordFace } from "../key-face";

// Slow breath: ~7 fps is plenty for a pulse and kind to the shared USB pipe.
const PULSE_MS = 150;
// Reconcile against OBS this often while the key is on screen. Cheap, and the
// only thing standing between a missed event and a key that lies all session.
const RECONCILE_MS = 5_000;

/**
 * Corpus recording on one key. Idle it's a plain circle (white ready, dim when
 * OBS is down); rolling, it becomes a red key with a breathing core and the
 * elapsed time underneath. Press toggles, cold-starting OBS first if it's dead.
 * Recordings land in ~/Movies untouched; processing is a separate, later act.
 *
 * DOCTRINE, learned the hard way 2026-08-01 ("the recording button is stuck on
 * ... I push the button and it just gives me a caution sign"): this key must
 * never act on remembered state. It had latched `recording = true`, missed the
 * stop event — a plugin restart mid-session is enough — and from then on every
 * press sent StopRecord to an output that wasn't running, which errors, which
 * draws the caution triangle, which changes nothing. A key that reports a state
 * OBS does not agree with is worse than a key that does nothing.
 *
 * So: the press re-reads OBS before deciding, the event payload is trusted over
 * a round-trip, and a slow reconcile heals anything that still slips through.
 */
@action({ UUID: "com.blessdog.obs-control-room.record" })
export class Record extends SingletonAction {
	private readonly log = streamDeck.logger.createScope("record");
	private recording = false;
	// Date.now() at record start, so elapsed is computed locally each frame
	// instead of hammering OBS with GetRecordStatus every 150ms.
	private startedAtMs = 0;
	private visible = 0;
	private reconcileTimer: NodeJS.Timeout | undefined;

	private readonly pulse = new KeyAnimator(
		(t) => recordFace({ connected: true, recording: true, t, elapsedMs: Date.now() - this.startedAtMs }),
		(uri) => this.broadcast(uri),
		PULSE_MS,
	);

	constructor() {
		super();
		obs.on("connected", () => void this.refresh());
		obs.on("disconnected", () => this.apply(false));
		obs.on("RecordStateChanged", ({ outputActive, outputState }) => {
			// STARTING/STOPPING are transitional; the authoritative edges are
			// STARTED and STOPPED, and outputActive already encodes them.
			this.log.info(`RecordStateChanged active=${outputActive} state=${outputState}`);
			if (outputActive) void this.refresh();
			else this.apply(false);
		});
	}

	override onWillAppear(_ev: WillAppearEvent): void {
		this.visible++;
		this.reconcileTimer ??= setInterval(() => void this.refresh(), RECONCILE_MS);
		void this.refresh();
	}

	override onWillDisappear(_ev: WillDisappearEvent): void {
		if (--this.visible <= 0) {
			this.visible = 0;
			this.pulse.stop(); // never animate a key nobody can see
			if (this.reconcileTimer) {
				clearInterval(this.reconcileTimer);
				this.reconcileTimer = undefined;
			}
		}
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		try {
			if (!obs.connected) {
				await ev.action.setImage(recordFace({ connected: false, recording: false, note: "starting OBS" }));
				await obs.ensureOBS();
			}
			// Ask OBS what's true RIGHT NOW rather than trusting the cached
			// flag. This is the line that makes the key impossible to wedge.
			const { outputActive } = await obs.call("GetRecordStatus");
			if (outputActive) {
				await obs.call("StopRecord");
				await ev.action.showOk();
			} else {
				await obs.call("StartRecord");
			}
		} catch (err) {
			this.log.error(`toggle failed: ${err}`);
			await ev.action.showAlert();
		}
		// Whatever happened, repaint from OBS's truth — including after a
		// failure, so a bad press can never leave a lying face behind.
		void this.refresh();
	}

	private async refresh(): Promise<void> {
		if (obs.connected) {
			try {
				const s = await obs.call("GetRecordStatus");
				this.startedAtMs = Date.now() - (s.outputDuration ?? 0);
				this.apply(s.outputActive);
				return;
			} catch {
				/* fall through to the offline face rather than keep a stale one */
			}
		}
		this.apply(false);
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
