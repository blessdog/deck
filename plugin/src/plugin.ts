import streamDeck from "@elgato/streamdeck";
import { obs } from "./obs-connection";
import { MeetingMode } from "./actions/meeting-mode";
import { ScreenPicker } from "./actions/screen-picker";
import { ShowFlow } from "./actions/show-flow";
import { Status } from "./actions/status";

streamDeck.actions.registerAction(new Status());
streamDeck.actions.registerAction(new ScreenPicker());
streamDeck.actions.registerAction(new MeetingMode());
streamDeck.actions.registerAction(new ShowFlow());

// Websocket connections die over sleep; retry immediately on wake.
streamDeck.system.onSystemDidWakeUp(() => obs.poke());

obs.start();
await streamDeck.connect();
