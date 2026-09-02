import { action, KeyDownEvent, KeyUpEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obs } from "../obs-connection";
import { face, GLYPHS } from "../key-face";

// Registered by vendor/obs-zoom-to-mouse.lua (see scripts/install-zoom.mjs).
const ZOOM_HOTKEY = "toggle_zoom_hotkey";
const FOLLOW_HOTKEY = "toggle_follow_hotkey";
const LONG_PRESS_MS = 450;

/**
 * Punch the screen capture in on the cursor, and follow it.
 *
 * The single highest-value key for the work Ryan actually does — screen shares
 * and commentary. The zoom itself is `obs-zoom-to-mouse`, a Lua script whose
 * author wrote it "to zoom into an IDE when highlighting certain sections of
 * code"; we don't reimplement it, we drive it.
 *
 * It's driven by NAME over the websocket we already hold
 * (TriggerHotkeyByName), not by emulating a keystroke. A synthetic keypress
 * would need Accessibility permission, could collide with whatever app has
 * focus, and would fire blind. This can't.
 *
 * Press = zoom in/out. Long press = toggle follow-the-cursor while zoomed, so
 * you can pin the view on one spot and talk over it without it drifting.
 */
@action({ UUID: "com.blessdog.obs-control-room.zoom" })
export class Zoom extends SingletonAction {
	private readonly log = streamDeck.logger.createScope("zoom");
	private pressedAt = 0;
	private longPress: NodeJS.Timeout | undefined;

	constructor() {
		super();
		obs.on("connected", () => this.render());
		obs.on("disconnected", () => this.render());
	}

	override onWillAppear(_ev: WillAppearEvent): void {
		this.render();
	}

	override onKeyDown(ev: KeyDownEvent): void {
		this.pressedAt = Date.now();
		this.longPress = setTimeout(() => {
			this.longPress = undefined;
			void this.fire(ev, FOLLOW_HOTKEY, "follow");
		}, LONG_PRESS_MS);
	}

	override async onKeyUp(ev: KeyUpEvent): Promise<void> {
		if (!this.longPress) return; // the long press already fired
		clearTimeout(this.longPress);
		this.longPress = undefined;
		if (Date.now() - this.pressedAt < LONG_PRESS_MS) await this.fire(ev, ZOOM_HOTKEY, "zoom");
	}

	private async fire(
		ev: KeyDownEvent | KeyUpEvent,
		hotkeyName: string,
		what: string,
	): Promise<void> {
		if (!obs.connected) {
			await ev.action.showAlert();
			return;
		}
		try {
			// Verify the hotkey exists rather than firing into the void: if the
			// lua didn't load, OBS accepts the request and silently does nothing.
			const { hotkeys } = await obs.call("GetHotkeyList");
			if (!hotkeys.includes(hotkeyName)) {
				this.log.error(`${hotkeyName} not registered — is vendor/obs-zoom-to-mouse.lua loaded?`);
				await ev.action.showAlert();
				return;
			}
			await obs.call("TriggerHotkeyByName", { hotkeyName });
			await ev.action.showOk();
			this.log.info(`fired ${what}`);
		} catch (err) {
			this.log.error(`${what} failed: ${err}`);
			await ev.action.showAlert();
		}
	}

	private render(): void {
		// No state to read back — the script owns whether it's zoomed and doesn't
		// report it — so the key stays honest by claiming nothing: available when
		// OBS is up, unavailable when it isn't.
		const uri = face({
			state: obs.connected ? "idle" : "offline",
			tint: "screen",
			glyph: GLYPHS.zoom,
		});
		for (const a of this.actions) void a.setImage(uri);
	}
}
