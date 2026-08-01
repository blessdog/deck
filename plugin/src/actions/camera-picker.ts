import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obs } from "../obs-connection";
import { face, GLYPHS, KeyState } from "../key-face";

const INPUT = "Camera";

// Never offer OBS's own virtual camera (feedback loop) or the Desk View
// top-down camera; an empty id is the "no device" placeholder row.
const usable = (name: string, id: string) =>
	id !== "" && name !== "OBS Virtual Camera" && !/desk view/i.test(name);

const shortName = (name: string) =>
	/facetime/i.test(name) ? "BUILT-IN" : /iphone/i.test(name) ? "iPHONE" : name.toUpperCase();

/**
 * Cycle which physical camera the shared "Camera" source captures
 * (iPhone Continuity <-> built-in FaceTime HD <-> whatever else is
 * plugged in). Born from the day Continuity Camera froze a session:
 * a moody camera should cost one key press, not a debugging detour.
 * Reads truth from OBS, never assumes; face shows the live pick.
 */
@action({ UUID: "com.blessdog.obs-control-room.camera-picker" })
export class CameraPicker extends SingletonAction {
	private readonly log = streamDeck.logger.createScope("camera-picker");

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
				await ev.action.setImage(face({ state: "idle", label: "STARTING", sub: "OBS" }));
				await obs.ensureOBS();
			}
			const cams = await this.cameras();
			if (cams.length === 0) throw new Error("no usable cameras");
			const { inputSettings } = await obs.call("GetInputSettings", { inputName: INPUT });
			const i = cams.findIndex((c) => c.id === inputSettings.device);
			const next = cams[(i + 1) % cams.length];
			await obs.call("SetInputSettings", {
				inputName: INPUT,
				inputSettings: { device: next.id, device_name: next.name },
			});
			// Cutout scenes capture through their own "Camera FX" input —
			// keep it on the same physical camera or they silently diverge.
			await obs
				.call("SetInputSettings", {
					inputName: "Camera FX",
					inputSettings: { device: next.id, device_name: next.name },
				})
				.catch(() => {});
			await ev.action.showOk();
		} catch (err) {
			this.log.error(`switch failed: ${err}`);
			await ev.action.showAlert();
		}
		void this.render();
	}

	private async cameras(): Promise<{ name: string; id: string }[]> {
		const { propertyItems } = await obs.call("GetInputPropertiesListPropertyItems", {
			inputName: INPUT,
			propertyName: "device",
		});
		return propertyItems
			.map((p: any) => ({ name: String(p.itemName), id: String(p.itemValue) }))
			.filter((c: { name: string; id: string }) => usable(c.name, c.id));
	}

	private async render(): Promise<void> {
		const uri = face(await this.currentFace());
		for (const a of this.actions) void a.setImage(uri);
	}

	private async currentFace(): Promise<{ state: KeyState; glyph: string; sub?: string; label?: string }> {
		if (!obs.connected) {
			return { state: "offline", glyph: GLYPHS.camera };
		}
		try {
			const cams = await this.cameras();
			const { inputSettings } = await obs.call("GetInputSettings", { inputName: INPUT });
			const current = cams.find((c) => c.id === inputSettings.device);
			if (!current) {
				return { state: "alert", glyph: GLYPHS.camera, sub: "gone" };
			}
			// The device name IS live data, so it earns its text line; the
			// iPhone (the good camera) lights the key, built-in stays quiet.
			return {
				state: /facetime/i.test(current.name) ? "idle" : "active",
				glyph: GLYPHS.camera,
				sub: shortName(current.name),
			};
		} catch {
			return { state: "offline", glyph: GLYPHS.camera };
		}
	}
}
