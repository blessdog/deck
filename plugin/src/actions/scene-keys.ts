import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { obs, SCENES } from "../obs-connection";
import { COLORS, face } from "../key-face";

/**
 * One key per Control Room scene, zero config: press = cut to that scene
 * (cold-starting OBS first if needed). The key for the scene that's on air
 * lights up red with a dot.
 */
abstract class SceneKey extends SingletonAction {
	protected abstract readonly scene: string;
	protected abstract readonly label: string;
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
				await ev.action.setImage(face({ tag: "SCENE", label: "STARTING", sub: "…", color: COLORS.ready }));
				await obs.ensureOBS();
			}
			await obs.call("SetCurrentProgramScene", { sceneName: this.scene });
		} catch {
			await ev.action.showAlert();
			void this.render();
		}
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
		const active = obs.connected && this.current === this.scene;
		const uri = face({
			tag: "SCENE",
			label: this.label,
			sub: active ? "on air" : undefined,
			color: !obs.connected ? COLORS.offline : active ? COLORS.live : COLORS.ready,
			dot: active,
		});
		for (const a of this.actions) void a.setImage(uri);
	}
}

@action({ UUID: "com.blessdog.obs-control-room.scene-starting-soon" })
export class SceneStartingSoon extends SceneKey {
	protected readonly scene = SCENES.startingSoon;
	protected readonly label = "STARTING";
}

@action({ UUID: "com.blessdog.obs-control-room.scene-screen-left" })
export class SceneScreenLeft extends SceneKey {
	protected readonly scene = SCENES.screenLeft;
	protected readonly label = "SCREEN L";
}

@action({ UUID: "com.blessdog.obs-control-room.scene-screen-right" })
export class SceneScreenRight extends SceneKey {
	protected readonly scene = SCENES.screenRight;
	protected readonly label = "SCREEN R";
}

@action({ UUID: "com.blessdog.obs-control-room.scene-cam" })
export class SceneCam extends SceneKey {
	protected readonly scene = SCENES.cam;
	protected readonly label = "CAM";
}

@action({ UUID: "com.blessdog.obs-control-room.scene-screen-cam" })
export class SceneScreenCam extends SceneKey {
	protected readonly scene = SCENES.screenCam;
	protected readonly label = "SCRN+CAM";
}

@action({ UUID: "com.blessdog.obs-control-room.scene-cam-cutout" })
export class SceneCamCutout extends SceneKey {
	protected readonly scene = SCENES.camCutout;
	protected readonly label = "CUTOUT";
}

@action({ UUID: "com.blessdog.obs-control-room.scene-lava-lounge" })
export class SceneLavaLounge extends SceneKey {
	protected readonly scene = "Lava Lounge";
	protected readonly label = "LAVA+ME";
}

@action({ UUID: "com.blessdog.obs-control-room.scene-ending" })
export class SceneEnding extends SceneKey {
	protected readonly scene = SCENES.ending;
	protected readonly label = "ENDING";
}
