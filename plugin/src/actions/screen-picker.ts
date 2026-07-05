import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obs } from "../obs-connection";
import { COLORS, face } from "../key-face";

const INPUT = "Display";

/**
 * Toggle which display the shared "Display" source captures:
 * built-in <-> external. Reads truth from OBS, never assumes.
 */
@action({ UUID: "com.blessdog.obs-control-room.screen-picker" })
export class ScreenPicker extends SingletonAction {
	private readonly log = streamDeck.logger.createScope("screen-picker");

	constructor() {
		super();
		obs.on("connected", () => void this.render());
		obs.on("disconnected", () => void this.render());
		obs.on("InputSettingsChanged", ({ inputName }) => {
			if (inputName === INPUT) void this.render();
		});
	}

	override onWillAppear(_ev: WillAppearEvent): void {
		void this.render();
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		try {
			if (!obs.connected) {
				await ev.action.setImage(face({ tag: "SHARING", label: "STARTING", sub: "…", color: COLORS.ready }));
				await obs.ensureOBS();
			}
			const displays = obs.displayUUIDs();
			const { inputSettings } = await obs.call("GetInputSettings", { inputName: INPUT });
			const current = displays.find((d) => d.uuid === inputSettings.display_uuid);
			const next = displays.find((d) => d.uuid !== current?.uuid) ?? displays[0];
			await obs.call("SetInputSettings", {
				inputName: INPUT,
				inputSettings: { display_uuid: next.uuid },
			});
			await ev.action.showOk();
		} catch (err) {
			this.log.error(`toggle failed: ${err}`);
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
			return { tag: "SHARING", label: "SCREEN", sub: "OBS offline", color: COLORS.offline };
		}
		try {
			const displays = obs.displayUUIDs();
			const { inputSettings } = await obs.call("GetInputSettings", { inputName: INPUT });
			const current = displays.find((d) => d.uuid === inputSettings.display_uuid);
			if (!current) {
				return { tag: "SHARING", label: "NO DISPLAY", sub: "press to fix", color: COLORS.rec };
			}
			return {
				tag: "SHARING",
				label: current.builtin ? "BUILT-IN" : "EXTERNAL",
				sub: "press to switch",
				color: current.builtin ? COLORS.ready : COLORS.meeting,
			};
		} catch {
			return { tag: "SHARING", label: "SCREEN", sub: "?", color: COLORS.offline };
		}
	}
}
