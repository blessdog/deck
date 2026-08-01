import streamDeck from "@elgato/streamdeck";
import { obs } from "./obs-connection";
import { CameraPicker } from "./actions/camera-picker";
import { Mark } from "./actions/mark";
import { MeetingMode } from "./actions/meeting-mode";
import { MuteMic } from "./actions/mute-mic";
import { Record } from "./actions/record";
import {
	SceneCam,
	SceneCamCutout,
	SceneEnding,
	SceneLavaLounge,
	SceneScreenCam,
	SceneScreenLeft,
	SceneScreenRight,
	SceneStartingSoon,
} from "./actions/scene-keys";
import { Status } from "./actions/status";

streamDeck.actions.registerAction(new Status());
streamDeck.actions.registerAction(new Record());
streamDeck.actions.registerAction(new Mark());
streamDeck.actions.registerAction(new MuteMic());
streamDeck.actions.registerAction(new CameraPicker());
streamDeck.actions.registerAction(new MeetingMode());
streamDeck.actions.registerAction(new SceneStartingSoon());
streamDeck.actions.registerAction(new SceneScreenLeft());
streamDeck.actions.registerAction(new SceneScreenRight());
streamDeck.actions.registerAction(new SceneCam());
streamDeck.actions.registerAction(new SceneCamCutout());
streamDeck.actions.registerAction(new SceneScreenCam());
streamDeck.actions.registerAction(new SceneLavaLounge());
streamDeck.actions.registerAction(new SceneEnding());

// Websocket connections die over sleep; retry immediately on wake.
streamDeck.system.onSystemDidWakeUp(() => obs.poke());

obs.start();
await streamDeck.connect();
