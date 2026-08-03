import streamDeck from "@elgato/streamdeck";
import { obs } from "./obs-connection";
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
import { Status } from "./actions/status";
import { RectumCrop, RectumLeft, RectumRight } from "./actions/rectum";
import { Zoom } from "./actions/zoom";

streamDeck.actions.registerAction(new Status());
streamDeck.actions.registerAction(new Record());
streamDeck.actions.registerAction(new Mark());
streamDeck.actions.registerAction(new MuteMic());
streamDeck.actions.registerAction(new Zoom());
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

// Websocket connections die over sleep; retry immediately on wake.
streamDeck.system.onSystemDidWakeUp(() => obs.poke());

obs.start();
await streamDeck.connect();
