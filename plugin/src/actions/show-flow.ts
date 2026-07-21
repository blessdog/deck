import { action, KeyDownEvent, KeyUpEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obs, SCENES, sleep } from "../obs-connection";
import { COLORS, face, fmtDuration } from "../key-face";

const COUNTDOWN_S = 10;
const LONG_PRESS_MS = 1_500;
const ENDING_HOLD_MS = 3_000;

// obs-websocket-js rejections stringify to a bare "Error" — log the parts.
const describe = (err: unknown): string =>
	err instanceof Error ? `${err.name}(${(err as any).code ?? "?"}): ${err.message}` : String(err);

type Phase = "idle" | "launching" | "preroll" | "golive" | "live" | "ending";

/**
 * The whole show open on one key:
 *   press (idle) -> cold-start OBS if dead -> Starting Soon -> 10s countdown
 *   -> Screen + Cam -> StartStream.
 * Press during countdown cancels. While live: short press hints, long press
 * (>=1.5s) plays the Ending scene for 3s and stops the stream.
 */
@action({ UUID: "com.blessdog.obs-control-room.show-flow" })
export class ShowFlow extends SingletonAction {
	private readonly log = streamDeck.logger.createScope("show-flow");
	private phase: Phase = "idle";
	private pressedAt = 0;
	private countdown = 0;
	private cancelRequested = false;
	private liveTimer: NodeJS.Timeout | undefined;

	constructor() {
		super();
		obs.on("connected", () => void this.render());
		obs.on("disconnected", () => this.reset());
		obs.on("StreamStateChanged", ({ outputActive, outputState }) => {
			if (outputActive) {
				this.phase = "live";
				this.startLiveTimer();
			} else if (outputState === "OBS_WEBSOCKET_OUTPUT_STOPPED" && this.phase === "live") {
				// stream ended outside the key (OBS UI, official plugin, drop)
				this.reset();
			}
			void this.render();
		});
	}

	override onWillAppear(_ev: WillAppearEvent): void {
		void this.render();
	}

	override onKeyDown(_ev: KeyDownEvent): void {
		this.pressedAt = Date.now();
	}

	override async onKeyUp(ev: KeyUpEvent): Promise<void> {
		const held = Date.now() - this.pressedAt;
		switch (this.phase) {
			case "idle":
				await this.begin(ev);
				break;
			case "preroll":
				this.cancelRequested = true;
				break;
			case "live":
				if (held >= LONG_PRESS_MS) {
					await this.endShow(ev);
				} else {
					const uri = face({ tag: "SHOW", label: "HOLD", sub: "1.5s to end", color: COLORS.rec });
					await ev.action.setImage(uri);
					setTimeout(() => void this.render(), 1_200);
				}
				break;
			default:
				// launching/golive/ending: mid-transition, ignore presses
				break;
		}
	}

	private async begin(ev: KeyUpEvent): Promise<void> {
		try {
			this.phase = "launching";
			void this.render();
			await obs.ensureOBS();
			await obs.call("SetCurrentProgramScene", { sceneName: SCENES.startingSoon });

			this.phase = "preroll";
			this.cancelRequested = false;
			for (this.countdown = COUNTDOWN_S; this.countdown > 0; this.countdown--) {
				void this.render();
				await sleep(1_000);
				if (this.cancelRequested) {
					this.log.info("countdown cancelled");
					this.reset();
					void this.render();
					return;
				}
			}

			this.phase = "golive";
			void this.render();
			await obs.call("SetCurrentProgramScene", { sceneName: SCENES.screenCam });
			await obs.call("StartStream");
			// "live" phase is set by StreamStateChanged when OBS confirms
		} catch (err) {
			this.log.error(`go-live failed: ${describe(err)}`);
			this.reset();
			await ev.action.showAlert();
			const uri = face({ tag: "SHOW", label: "NO KEY?", sub: "check stream setup", color: COLORS.rec });
			for (const a of this.actions) void a.setImage(uri);
			try {
				await obs.call("SetCurrentProgramScene", { sceneName: SCENES.startingSoon });
			} catch {
				/* OBS may be gone entirely */
			}
			setTimeout(() => void this.render(), 4_000);
		}
	}

	private async endShow(ev: KeyUpEvent): Promise<void> {
		try {
			this.phase = "ending";
			void this.render();
			await obs.call("SetCurrentProgramScene", { sceneName: SCENES.ending });
			await sleep(ENDING_HOLD_MS);
			// The stream can die on its own during the 3s Ending hold (drop,
			// OBS UI stop) — StopStream on an inactive output throws, which
			// was the 2026-07-13 "end-show failed" incident. Stop only if
			// still active; either way the show ended.
			const { outputActive } = await obs.call("GetStreamStatus");
			if (outputActive) await obs.call("StopStream");
			this.reset();
			await ev.action.showOk();
		} catch (err) {
			this.log.error(`end-show failed: ${describe(err)}`);
			this.reset();
			await ev.action.showAlert();
		}
		void this.render();
	}

	private startLiveTimer(): void {
		this.liveTimer ??= setInterval(() => void this.render(), 1_000);
	}

	private reset(): void {
		this.phase = "idle";
		this.cancelRequested = false;
		if (this.liveTimer) {
			clearInterval(this.liveTimer);
			this.liveTimer = undefined;
		}
	}

	private async render(): Promise<void> {
		const uri = face(await this.currentFace());
		for (const a of this.actions) void a.setImage(uri);
	}

	private async currentFace() {
		switch (this.phase) {
			case "launching":
				return { tag: "SHOW", label: "STARTING", sub: "OBS…", color: COLORS.ready };
			case "preroll":
				return { tag: "SHOW", label: String(this.countdown), sub: "press to cancel", color: COLORS.live };
			case "golive":
				return { tag: "SHOW", label: "GOING LIVE", sub: "…", color: COLORS.live };
			case "live": {
				let sub = "hold to end";
				try {
					const s = await obs.call("GetStreamStatus");
					sub = `${fmtDuration(s.outputDuration)} · hold to end`;
				} catch {
					/* keep default */
				}
				return { tag: "SHOW", label: "LIVE", sub, color: COLORS.live, dot: true };
			}
			case "ending":
				return { tag: "SHOW", label: "ENDING", sub: "…", color: COLORS.rec };
			default:
				return obs.connected
					? { tag: "SHOW", label: "GO LIVE", sub: "press to start", color: COLORS.ready }
					: { tag: "SHOW", label: "GO LIVE", sub: "OBS off · press", color: COLORS.offline };
		}
	}
}
