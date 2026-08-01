import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obs, SCENES } from "../obs-connection";
import { face, GLYPHS } from "../key-face";

/**
 * One press preps a meeting share: Screen + Cam scene, virtual camera ON —
 * then pick "OBS Virtual Camera" in Zoom/Meet. Press again to turn it off.
 */
@action({ UUID: "com.blessdog.obs-control-room.meeting-mode" })
export class MeetingMode extends SingletonAction {
	private readonly log = streamDeck.logger.createScope("meeting-mode");
	private vcamActive = false;

	constructor() {
		super();
		obs.on("connected", () => void this.refresh());
		obs.on("disconnected", () => {
			this.vcamActive = false;
			void this.render();
		});
		obs.on("VirtualcamStateChanged", ({ outputActive }) => {
			this.vcamActive = outputActive;
			void this.render();
		});
	}

	override onWillAppear(_ev: WillAppearEvent): void {
		void this.refresh();
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		try {
			if (!obs.connected) {
				await ev.action.setImage(face({ state: "idle", tint: "camera", glyph: GLYPHS.meeting, sub: "starting OBS" }));
				await obs.ensureOBS();
			}
			if (this.vcamActive) {
				await obs.call("StopVirtualCam");
			} else {
				await obs.call("SetCurrentProgramScene", { sceneName: SCENES.screenCam });
				await obs.call("StartVirtualCam");
			}
			await ev.action.showOk();
		} catch (err) {
			this.log.error(`toggle failed: ${err}`);
			await ev.action.showAlert();
			void this.render();
		}
	}

	private async refresh(): Promise<void> {
		if (obs.connected) {
			try {
				const { outputActive } = await obs.call("GetVirtualCamStatus");
				this.vcamActive = outputActive;
			} catch {
				this.vcamActive = false;
			}
		}
		void this.render();
	}

	private render(): void {
		// Virtual camera live = the whole key lights, because "am I still
		// broadcasting into that meeting?" must be answerable at a glance.
		const uri = face(
			!obs.connected
				? { state: "offline", tint: "camera", glyph: GLYPHS.meeting }
				: this.vcamActive
					? { state: "active", tint: "camera", glyph: GLYPHS.meeting, sub: "on air" }
					: { state: "idle", tint: "camera", glyph: GLYPHS.meeting },
		);
		for (const a of this.actions) void a.setImage(uri);
	}
}
