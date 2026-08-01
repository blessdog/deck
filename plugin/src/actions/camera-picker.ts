import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obs } from "../obs-connection";
import { face, GLYPHS, KeyState, Tint } from "../key-face";

const INPUT = "Camera";

// Never offer OBS's own virtual camera (feedback loop) or the Desk View
// top-down camera; an empty id is the "no device" placeholder row. `enabled`
// is what OBS reports as actually present — a Continuity Camera from a phone
// you no longer own still appears in the list, greyed out, and selecting it
// silently produces nothing.
const usable = (name: string, id: string, enabled: boolean) =>
	enabled && id !== "" && name !== "OBS Virtual Camera" && !/desk view/i.test(name);

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
		obs.on("connected", () => void this.healDeadCamera().then(() => this.render()));
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
			.map((p: any) => ({
				name: String(p.itemName),
				id: String(p.itemValue),
				enabled: p.itemEnabled !== false,
			}))
			.filter((c: { name: string; id: string; enabled: boolean }) =>
				usable(c.name, c.id, c.enabled),
			)
			.map(({ name, id }: { name: string; id: string }) => ({ name, id }));
	}

	/**
	 * Repoint the camera if it's aimed at a device that no longer exists.
	 *
	 * Continuity Camera device IDs are per-phone, so swapping phones leaves
	 * every camera scene pointed at a ghost: the source resolves to nothing,
	 * renders 0x0, and the picture-in-picture bubble just isn't there. OBS
	 * reports no error and the deck looks fine. That is exactly the class of
	 * silent lie this whole instrument is supposed to refuse, so on every
	 * connect we check the configured device is really present and heal it if
	 * not. Found 2026-08-01: "Screen + Cam is just showing the screenshare".
	 */
	private async healDeadCamera(): Promise<void> {
		try {
			const cams = await this.cameras();
			if (cams.length === 0) return;
			const { inputSettings } = await obs.call("GetInputSettings", { inputName: INPUT });
			if (cams.some((c) => c.id === inputSettings.device)) return;

			// Prefer a Continuity Camera video feed; it's the good camera and the
			// only path that keeps Center Stage.
			const pick = cams.find((c) => /iphone/i.test(c.name) && /camera$/i.test(c.name)) ?? cams[0];
			this.log.warn(
				`camera device ${inputSettings.device_name ?? inputSettings.device} is gone — switching to ${pick.name}`,
			);
			for (const inputName of [INPUT, "Camera FX"]) {
				await obs
					.call("SetInputSettings", {
						inputName,
						inputSettings: { device: pick.id, device_name: pick.name },
					})
					.catch(() => {});
			}
		} catch (err) {
			this.log.error(`heal failed: ${err}`);
		}
	}

	private async render(): Promise<void> {
		const uri = face(await this.currentFace());
		for (const a of this.actions) void a.setImage(uri);
	}

	private async currentFace(): Promise<{ state: KeyState; tint: Tint; glyph: string; sub?: string; label?: string }> {
		if (!obs.connected) {
			return { state: "offline", tint: "camera" as const, glyph: GLYPHS.camera };
		}
		try {
			const cams = await this.cameras();
			const { inputSettings } = await obs.call("GetInputSettings", { inputName: INPUT });
			const current = cams.find((c) => c.id === inputSettings.device);
			if (!current) {
				return { state: "alert", tint: "camera" as const, glyph: GLYPHS.camera, sub: "gone" };
			}
			// The device name IS live data, so it earns its text line; the
			// iPhone (the good camera) lights the key, built-in stays quiet.
			return {
				state: /facetime/i.test(current.name) ? "idle" : "active",
				tint: "camera" as const,
				glyph: GLYPHS.camera,
				sub: shortName(current.name),
			};
		} catch {
			return { state: "offline", tint: "camera" as const, glyph: GLYPHS.camera };
		}
	}
}
