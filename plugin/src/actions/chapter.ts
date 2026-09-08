import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { cues } from "../cues";
import { obs, SCENES } from "../obs-connection";
import { face, fmtDuration, GLYPHS, KeyState } from "../key-face";

/** The media source inside the Chapter overlay scene (obs/setup-cues.mjs). */
const STING_INPUT = "Chapter Sting";
/** If the media-ended event never arrives, the overlay comes down anyway. */
const SAFETY_MS = 3_000;

/**
 * CHAPTER — a subject change you can see and find later: the sting wipes over
 * the current shot with its whoosh, and, while recording, a chapter marker
 * lands in the MP4 at the same moment. Not recording: the sting still plays,
 * there is simply no file for the marker to live in.
 *
 * The sting is a media source with alpha played OVER the shot, not a scene
 * transition — a chapter break is usually the same shot before and after, and
 * OBS cannot transition a scene to itself. It restarts from frame one on each
 * show and the overlay hides itself when the media reports it has ended, so a
 * second press mid-sting restarts rather than stacks.
 */
@action({ UUID: "com.blessdog.obs-control-room.chapter" })
export class Chapter extends SingletonAction {
	private readonly log = streamDeck.logger.createScope("chapter");
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
		obs.on("MediaInputPlaybackEnded", ({ inputName }) => {
			if (inputName === STING_INPUT) void cues.hideOverlay("chapter", "sting ended");
		});
		cues.on("changed", () => void this.render());
	}

	override onWillAppear(_ev: WillAppearEvent): void {
		void this.refresh();
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		if (!obs.connected) {
			await ev.action.showAlert();
			return;
		}
		try {
			if (this.recording) {
				const t = fmtDuration((await obs.call("GetRecordStatus")).outputDuration);
				await obs.call("CreateRecordChapter", { chapterName: `chapter ${t}` });
			}
			await cues.showOverlay("chapter", SCENES.chapter, SAFETY_MS);
		} catch (err) {
			this.log.error(`chapter failed: ${err}`);
			await ev.action.showAlert();
		}
		void this.render();
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
		const state: KeyState = !obs.connected ? "offline" : cues.overlayActive("chapter") ? "active" : "idle";
		// The recording timecode is the only text: it says a marker WILL land.
		const uri = face({ state, tint: "mark", glyph: GLYPHS.chapter, sub: this.recording ? "marks" : undefined });
		for (const a of this.actions) void a.setImage(uri);
	}
}
