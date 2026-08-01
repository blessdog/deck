import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { obs, SCENES } from "../obs-connection";
import { face, GLYPHS, KeyState, monitorsArt, screenCamArt } from "../key-face";

/**
 * One key per Control Room scene, zero config: press = cut to that scene
 * (cold-starting OBS first if needed). The scene that's on air lights the
 * whole key teal — you see what's live from across the room, which is the
 * point of a tally.
 *
 * Every scene key carries a picture. Bare-text scene keys were the single
 * worst thing about the old deck: seven near-identical grey words that all
 * needed reading.
 */
abstract class SceneKey extends SingletonAction {
	protected abstract readonly scene: string;
	protected abstract readonly label: string;
	/** Glyph for this scene. Screen keys override art() instead. */
	protected readonly glyph: string | undefined;
	private current = "";

	constructor() {
		super();
		obs.on("connected", () => void this.refresh());
		obs.on("disconnected", () => {
			this.current = "";
			void this.render();
		});
		obs.on("CurrentProgramSceneChanged", ({ sceneName }) => {
			this.current = sceneName;
			void this.render();
		});
	}

	override onWillAppear(_ev: WillAppearEvent): void {
		void this.refresh();
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		try {
			if (!obs.connected) {
				await ev.action.setImage(this.paint("idle", "starting OBS"));
				await obs.ensureOBS();
			}
			await obs.call("SetCurrentProgramScene", { sceneName: this.scene });
		} catch {
			await ev.action.showAlert();
			void this.render();
		}
	}

	/** Composite art for keys that draw more than one shape (the screens). */
	protected art(_state: KeyState): string | undefined {
		return undefined;
	}

	private paint(state: KeyState, sub?: string): string {
		return face({ state, glyph: this.glyph, art: this.art(state), label: sub ? undefined : this.label, sub });
	}

	private async refresh(): Promise<void> {
		if (obs.connected) {
			try {
				this.current = (await obs.call("GetCurrentProgramScene")).currentProgramSceneName;
			} catch {
				/* keep last known */
			}
		}
		void this.render();
	}

	private render(): void {
		const state: KeyState = !obs.connected
			? "offline"
			: this.current === this.scene
				? "active"
				: "idle";
		const uri = this.paint(state);
		for (const a of this.actions) void a.setImage(uri);
	}
}

/**
 * A screen key draws the actual monitor arrangement with its own display
 * filled — a picture of the desk instead of the words SCREEN L. `position`
 * is resolved against the live, x-sorted display list, so a third monitor
 * changes the picture rather than making the key lie.
 */
abstract class ScreenSceneKey extends SceneKey {
	/** 0 = leftmost display, -1 = rightmost. */
	protected abstract readonly position: number;

	protected override art(state: KeyState): string {
		const count = Math.max(obs.displays().length, 1);
		const index = this.position < 0 ? count + this.position : this.position;
		return monitorsArt(count, Math.max(0, Math.min(index, count - 1)), state);
	}
}

@action({ UUID: "com.blessdog.obs-control-room.scene-starting-soon" })
export class SceneStartingSoon extends SceneKey {
	protected readonly scene = SCENES.startingSoon;
	protected readonly label = "SOON";
	protected override readonly glyph = GLYPHS.hourglass;
}

@action({ UUID: "com.blessdog.obs-control-room.scene-screen-left" })
export class SceneScreenLeft extends ScreenSceneKey {
	protected readonly scene = SCENES.screenLeft;
	protected readonly label = "LEFT";
	protected readonly position = 0;
}

@action({ UUID: "com.blessdog.obs-control-room.scene-screen-right" })
export class SceneScreenRight extends ScreenSceneKey {
	protected readonly scene = SCENES.screenRight;
	protected readonly label = "RIGHT";
	protected readonly position = -1;
}

@action({ UUID: "com.blessdog.obs-control-room.scene-cam" })
export class SceneCam extends SceneKey {
	protected readonly scene = SCENES.cam;
	protected readonly label = "CAM";
	protected override readonly glyph = GLYPHS.camera;
}

@action({ UUID: "com.blessdog.obs-control-room.scene-screen-cam" })
export class SceneScreenCam extends SceneKey {
	protected readonly scene = SCENES.screenCam;
	protected readonly label = "SCREEN+ME";
	protected override art(state: KeyState): string {
		return screenCamArt(state);
	}
}

@action({ UUID: "com.blessdog.obs-control-room.scene-cam-cutout" })
export class SceneCamCutout extends SceneKey {
	protected readonly scene = SCENES.camCutout;
	protected readonly label = "CUTOUT";
	protected override readonly glyph = GLYPHS.person;
}

@action({ UUID: "com.blessdog.obs-control-room.scene-lava-lounge" })
export class SceneLavaLounge extends SceneKey {
	protected readonly scene = "Lava Lounge";
	protected readonly label = "LAVA";
	protected override readonly glyph = GLYPHS.lamp;
}

@action({ UUID: "com.blessdog.obs-control-room.scene-ending" })
export class SceneEnding extends SceneKey {
	protected readonly scene = SCENES.ending;
	protected readonly label = "ENDING";
	protected override readonly glyph = GLYPHS.ending;
}
