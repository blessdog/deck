import streamDeck from "@elgato/streamdeck";
import { obs } from "./obs-connection";
import { MeetingMode } from "./actions/meeting-mode";
import { ScreenPicker } from "./actions/screen-picker";
import {
	SceneCam,
	SceneEnding,
	SceneLavaLounge,
	SceneScreen,
	SceneScreenCam,
	SceneStartingSoon,
} from "./actions/scene-keys";
import { ShowFlow } from "./actions/show-flow";
import { Status } from "./actions/status";

streamDeck.actions.registerAction(new Status());
streamDeck.actions.registerAction(new ScreenPicker());
streamDeck.actions.registerAction(new MeetingMode());
streamDeck.actions.registerAction(new ShowFlow());
streamDeck.actions.registerAction(new SceneStartingSoon());
streamDeck.actions.registerAction(new SceneScreen());
streamDeck.actions.registerAction(new SceneCam());
streamDeck.actions.registerAction(new SceneScreenCam());
streamDeck.actions.registerAction(new SceneLavaLounge());
streamDeck.actions.registerAction(new SceneEnding());

// Websocket connections die over sleep; retry immediately on wake.
streamDeck.system.onSystemDidWakeUp(() => obs.poke());

obs.start();
await streamDeck.connect();
