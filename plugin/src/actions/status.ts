import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { execFile } from "node:child_process";
import { obs } from "../obs-connection";
import { face, fmtDuration, KeyState } from "../key-face";

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
		// Press always means "get me OBS": launch it when dead, focus it when up.
		if (obs.connected) {
			execFile("/usr/bin/open", ["-a", "OBS"]);
			return;
		}
		await ev.action.setImage(face({ state: "idle", label: "STARTING", sub: "OBS" }));
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

	private async currentFace(): Promise<{ state: KeyState; label: string; sub?: string }> {
		if (!obs.connected) {
			return { state: "offline", label: "OFFLINE" };
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
					state: "recording",
					label: "LIVE",
					sub: `${fmtDuration(stream.outputDuration)} · ${dropped}%${rec}`,
				};
			}
			if (record.outputActive) {
				return { state: "recording", label: "REC", sub: fmtDuration(record.outputDuration) };
			}
			// scene name lives on the highlighted scene key, not here
			return { state: "idle", label: "READY" };
		} catch {
			return { state: "offline", label: "OFFLINE" };
		}
	}
}
