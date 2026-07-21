import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { obs } from "../obs-connection";
import { COLORS, face, fmtDuration } from "../key-face";

/**
 * Plain stream toggle — go live NOW, no countdown ceremony (Show Flow owns
 * the produced version). Press while OBS is dead cold-starts it first;
 * press while live stops the stream. Text face on purpose: LIVE is the
 * word that IS the picture.
 */
@action({ UUID: "com.blessdog.obs-control-room.stream" })
export class Stream extends SingletonAction {
	private streaming = false;
	private timer: NodeJS.Timeout | undefined;

	constructor() {
		super();
		obs.on("connected", () => void this.refresh());
		obs.on("disconnected", () => {
			this.streaming = false;
			this.stopTimer();
			void this.render();
		});
		obs.on("StreamStateChanged", ({ outputActive }) => {
			this.streaming = outputActive;
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
					face({ tag: "STREAM", label: "GO LIVE", sub: "starting OBS…", color: COLORS.ready }),
				);
				await obs.ensureOBS();
			}
			if (this.streaming) {
				await obs.call("StopStream");
				await ev.action.showOk();
			} else {
				await obs.call("StartStream");
			}
		} catch {
			await ev.action.showAlert();
			void this.render();
		}
	}

	private async refresh(): Promise<void> {
		if (obs.connected) {
			try {
				this.streaming = (await obs.call("GetStreamStatus")).outputActive;
			} catch {
				/* keep last known */
			}
		}
		if (this.streaming) this.startTimer();
		else this.stopTimer();
		void this.render();
	}

	private async render(): Promise<void> {
		let elapsed: string | undefined;
		if (this.streaming) {
			try {
				elapsed = fmtDuration((await obs.call("GetStreamStatus")).outputDuration);
			} catch {
				/* face still shows live state */
			}
		}
		const uri = face({
			tag: "STREAM",
			label: this.streaming ? "LIVE" : "GO LIVE",
			dot: this.streaming,
			sub: !obs.connected ? "OBS off · press" : this.streaming ? elapsed : "press to stream",
			color: !obs.connected ? COLORS.offline : this.streaming ? COLORS.live : COLORS.ready,
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
