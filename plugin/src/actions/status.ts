import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { obs } from "../obs-connection";
import { COLORS, face, fmtDuration } from "../key-face";

const POLL_MS = 3_000;

/**
 * OBS health at a glance: OFFLINE / READY / REC / LIVE with elapsed time and
 * dropped-frame %. Press while offline cold-starts OBS.
 */
@action({ UUID: "com.blessdog.obs-control-room.status" })
export class Status extends SingletonAction {
	private timer: NodeJS.Timeout | undefined;

	constructor() {
		super();
		obs.on("connected", () => void this.render());
		obs.on("disconnected", () => void this.render());
		obs.on("StreamStateChanged", () => void this.render());
		obs.on("RecordStateChanged", () => void this.render());
		obs.on("CurrentProgramSceneChanged", () => void this.render());
	}

	override onWillAppear(_ev: WillAppearEvent): void {
		this.timer ??= setInterval(() => void this.render(), POLL_MS);
		void this.render();
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		if (obs.connected) return; // display-only while OBS is up
		await ev.action.setImage(face({ tag: "OBS", label: "STARTING", sub: "…", color: COLORS.ready }));
		try {
			await obs.ensureOBS();
			await ev.action.showOk();
		} catch {
			await ev.action.showAlert();
		}
		void this.render();
	}

	private async render(): Promise<void> {
		const uri = face(await this.currentFace());
		for (const a of this.actions) void a.setImage(uri);
	}

	private async currentFace() {
		if (!obs.connected) {
			return { tag: "OBS", label: "OFFLINE", sub: "press to launch", color: COLORS.offline };
		}
		try {
			const stream = await obs.call("GetStreamStatus");
			const record = await obs.call("GetRecordStatus");
			if (stream.outputActive) {
				const dropped =
					stream.outputTotalFrames > 0
						? Math.round((stream.outputSkippedFrames / stream.outputTotalFrames) * 1000) / 10
						: 0;
				const rec = record.outputActive ? " · REC" : "";
				return {
					tag: "OBS",
					label: "LIVE",
					sub: `${fmtDuration(stream.outputDuration)} · ${dropped}%${rec}`,
					color: COLORS.live,
					dot: true,
				};
			}
			if (record.outputActive) {
				return {
					tag: "OBS",
					label: "REC",
					sub: fmtDuration(record.outputDuration),
					color: COLORS.rec,
					dot: true,
				};
			}
			// scene name lives on the highlighted scene key, not here
			return { tag: "OBS", label: "READY", color: COLORS.ready };
		} catch {
			return { tag: "OBS", label: "OFFLINE", sub: "press to launch", color: COLORS.offline };
		}
	}
}
