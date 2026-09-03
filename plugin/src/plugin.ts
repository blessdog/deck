import streamDeck from "@elgato/streamdeck";
import { obs, sleep } from "./obs-connection";
import { healScreens } from "./screen-heal";
import { CameraPicker } from "./actions/camera-picker";
import { Mark } from "./actions/mark";
import { MeetingMode } from "./actions/meeting-mode";
import { MuteMic } from "./actions/mute-mic";
import { Record } from "./actions/record";
import {
	SceneCam,
	SceneBrb,
	SceneCamCutout,
	SceneEnding,
	SceneLavaLounge,
	SceneMeFloat,
	SceneScreenCam,
	SceneScreenLeft,
	SceneScreenRight,
	SceneStartingSoon,
} from "./actions/scene-keys";
import { RectumCrop, RectumGrab, RectumLeft, RectumRight } from "./actions/rectum";
import { Reveal } from "./actions/reveal";
import { Pause } from "./actions/pause";
import { Shot } from "./actions/shot";

streamDeck.actions.registerAction(new Record());
streamDeck.actions.registerAction(new Mark());
streamDeck.actions.registerAction(new MuteMic());
streamDeck.actions.registerAction(new Pause());
streamDeck.actions.registerAction(new Shot());
streamDeck.actions.registerAction(new Reveal());
streamDeck.actions.registerAction(new CameraPicker());
streamDeck.actions.registerAction(new MeetingMode());
streamDeck.actions.registerAction(new SceneStartingSoon());
streamDeck.actions.registerAction(new SceneScreenLeft());
streamDeck.actions.registerAction(new SceneScreenRight());
streamDeck.actions.registerAction(new SceneCam());
streamDeck.actions.registerAction(new SceneCamCutout());
streamDeck.actions.registerAction(new SceneScreenCam());
streamDeck.actions.registerAction(new SceneLavaLounge());
streamDeck.actions.registerAction(new SceneMeFloat());
streamDeck.actions.registerAction(new SceneBrb());
streamDeck.actions.registerAction(new SceneEnding());

// The rectum page — the clipper. Keys shell out to ~/projects/rectum.
streamDeck.actions.registerAction(new RectumLeft());
streamDeck.actions.registerAction(new RectumRight());
streamDeck.actions.registerAction(new RectumCrop());
streamDeck.actions.registerAction(new RectumGrab());

// Websocket connections die over sleep; retry immediately on wake. Screen
// capture streams die over sleep too, but silently — they keep delivering the
// wallpaper — so every wake and every connect rebuilds them (screen-heal.ts).
streamDeck.system.onSystemDidWakeUp(() => {
	obs.poke();
	void sleep(5000).then(healScreens);
});
obs.on("connected", () => void sleep(3000).then(healScreens));

obs.start();
await streamDeck.connect();
