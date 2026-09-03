import {
	action,
	DialDownEvent,
	DialRotateEvent,
	SingletonAction,
	TouchTapEvent,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { obs } from "../obs-connection";

type Settings = { input?: string };

const DB_PER_TICK = 1.5;
const DB_MIN = -60; // indicator floor; OBS goes to -100 but nothing lives there
const DB_MAX = 6;

/**
 * VOLUME — one Stream Deck + dial per OBS audio input (Mic, SP-404, App Audio).
 *
 * Rotate: ±1.5 dB per tick. Press: toggle mute. Touch the strip: back to 0 dB.
 * The strip follows OBS's own InputVolumeChanged / InputMuteStateChanged
 * events, never a remembered value — the same doctrine as the Mute key.
 *
 * Which input a dial controls is per-dial settings (`input`), written by
 * scripts/build-profile.mjs from ENCODERS in deck-layout.mjs. No property
 * inspector: the layout is the config.
 */
@action({ UUID: "com.blessdog.obs-control-room.volume" })
export class Volume extends SingletonAction<Settings> {
	private readonly log = streamDeck.logger.createScope("volume");
	private readonly inputOf = new Map<string, string>(); // action id → input name

	constructor() {
		super();
		obs.on("connected", () => void this.refreshAll());
		obs.on("disconnected", () => void this.refreshAll());
		obs.on("InputVolumeChanged", ({ inputName, inputVolumeDb }) => void this.paintInput(inputName, { db: inputVolumeDb }));
		obs.on("InputMuteStateChanged", ({ inputName, inputMuted }) => void this.paintInput(inputName, { muted: inputMuted }));
	}

	override onWillAppear(ev: WillAppearEvent<Settings>): void {
		const input = ev.payload.settings.input;
		if (input) this.inputOf.set(ev.action.id, input);
		void this.refresh(ev.action.id);
	}

	override onWillDisappear(ev: WillDisappearEvent<Settings>): void {
		this.inputOf.delete(ev.action.id);
	}

	override async onDialRotate(ev: DialRotateEvent<Settings>): Promise<void> {
		const inputName = this.inputOf.get(ev.action.id);
		if (!inputName || !obs.connected) return;
		try {
			const { inputVolumeDb } = await obs.call("GetInputVolume", { inputName });
			const next = Math.max(DB_MIN, Math.min(DB_MAX, inputVolumeDb + ev.payload.ticks * DB_PER_TICK));
			await obs.call("SetInputVolume", { inputName, inputVolumeDb: next });
		} catch (err) {
			this.log.warn(`rotate ${inputName}: ${err}`);
		}
	}

	override async onDialDown(ev: DialDownEvent<Settings>): Promise<void> {
		const inputName = this.inputOf.get(ev.action.id);
		if (!inputName || !obs.connected) return;
		try {
			await obs.call("ToggleInputMute", { inputName });
		} catch (err) {
			this.log.warn(`mute ${inputName}: ${err}`);
		}
	}

	override async onTouchTap(ev: TouchTapEvent<Settings>): Promise<void> {
		const inputName = this.inputOf.get(ev.action.id);
		if (!inputName || !obs.connected) return;
		try {
			await obs.call("SetInputVolume", { inputName, inputVolumeDb: 0 });
		} catch (err) {
			this.log.warn(`reset ${inputName}: ${err}`);
		}
	}

	private async refreshAll(): Promise<void> {
		for (const id of this.inputOf.keys()) await this.refresh(id);
	}

	private async refresh(actionId: string): Promise<void> {
		const inputName = this.inputOf.get(actionId);
		const a = [...this.actions].find((x) => x.id === actionId);
		if (!a || !a.isDial()) return;
		if (!inputName) {
			await a.setFeedback({ title: "no input", value: "—", indicator: 0 });
			return;
		}
		if (!obs.connected) {
			await a.setFeedback({ title: inputName, value: "OBS off", indicator: 0 });
			return;
		}
		try {
			const [{ inputVolumeDb }, { inputMuted }] = await Promise.all([
				obs.call("GetInputVolume", { inputName }),
				obs.call("GetInputMute", { inputName }),
			]);
			await a.setFeedback(this.feedback(inputName, inputVolumeDb, inputMuted));
		} catch {
			await a.setFeedback({ title: inputName, value: "?", indicator: 0 });
		}
	}

	private async paintInput(inputName: string, change: { db?: number; muted?: boolean }): Promise<void> {
		for (const [id, name] of this.inputOf) {
			if (name !== inputName) continue;
			const a = [...this.actions].find((x) => x.id === id);
			if (!a || !a.isDial()) continue;
			try {
				const db = change.db ?? (await obs.call("GetInputVolume", { inputName })).inputVolumeDb;
				const muted = change.muted ?? (await obs.call("GetInputMute", { inputName })).inputMuted;
				await a.setFeedback(this.feedback(inputName, db, muted));
			} catch {
				/* next event repaints */
			}
		}
	}

	private feedback(inputName: string, db: number, muted: boolean) {
		const clamped = Math.max(DB_MIN, Math.min(DB_MAX, db));
		const indicator = Math.round(((clamped - DB_MIN) / (DB_MAX - DB_MIN)) * 100);
		return {
			title: muted ? `${inputName} · MUTED` : inputName,
			value: muted ? "muted" : `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`,
			indicator: muted ? 0 : indicator,
		};
	}
}
