import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { obs } from "../obs-connection";
import { face, fmtDuration, GLYPHS } from "../key-face";

/**
 * Flag this moment: while recording, press drops an OBS chapter marker
 * into the file itself (named with the recording timecode). No daemon, no
 * database — the mark travels inside the MP4, and ingest reads chapters
 * back out with ffprobe (verified 2026-07-21, media-studio
 * scripts/verify_record_chapters.py; OBS auto-adds a 'Start' chapter at 0
 * which ingest skips). Meaningless when not recording: the key dims and a
 * press just alerts.
 */
@action({ UUID: "com.blessdog.obs-control-room.mark" })
export class Mark extends SingletonAction {
	private recording = false;

	constructor() {
		super();
		obs.on("connected", () => void this.refresh());
		obs.on("disconnected", () => {
			this.recording = false;
			void this.render();
		});
		obs.on("RecordStateChanged", ({ outputActive }) => {
			this.recording = outputActive;
			void this.render();
		});
	}

	override onWillAppear(_ev: WillAppearEvent): void {
		void this.refresh();
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		if (!this.recording) {
			await ev.action.showAlert(); // a mark outside a recording has nowhere to live
			return;
		}
		try {
			const t = fmtDuration((await obs.call("GetRecordStatus")).outputDuration);
			await obs.call("CreateRecordChapter", { chapterName: `mark ${t}` });
			// Flash the whole key on the mark — confirmation you feel, not read.
			await ev.action.setImage(face({ state: "active", glyph: GLYPHS.mark, sub: t }));
			await ev.action.showOk();
			setTimeout(() => void this.render(), 900);
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
		void this.render();
	}

	private async render(): Promise<void> {
		// A mark outside a recording has nowhere to live, so the key reads
		// unavailable rather than merely idle.
		const uri = face({ state: this.recording ? "idle" : "offline", glyph: GLYPHS.mark });
		for (const a of this.actions) void a.setImage(uri);
	}
}
