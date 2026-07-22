import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obs, SCENES } from "../obs-connection";
import { COLORS, face, GLYPHS } from "../key-face";

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
				await ev.action.setImage(face({ glyph: GLYPHS.camera, sub: "starting OBS", color: COLORS.ready }));
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
		const uri = face(
			!obs.connected
				? { glyph: GLYPHS.camera, color: COLORS.offline }
				: this.vcamActive
					? { glyph: GLYPHS.camera, sub: "on air", color: COLORS.meeting }
					: { glyph: GLYPHS.camera, color: COLORS.ready },
		);
		for (const a of this.actions) void a.setImage(uri);
	}
}
