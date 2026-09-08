import {
	action,
	KeyDownEvent,
	KeyUpEvent,
	SingletonAction,
	WillAppearEvent,
	WillDisappearEvent,
} from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { bankLetter, spMidi } from "../midi";
import { face } from "../key-face";

/** Per-key settings, written by scripts/deck-layout.mjs — the layout IS the config. */
type PadSettings = { bank?: number; pad?: number; label?: string };

// Re-check for the SP this often while a pad key is on screen: plugging the
// unit in or power-cycling it must light the keys without a plugin restart.
const RECONCILE_MS = 10_000;

/**
 * PAD — one SP-404MKII pad on a deck key. Key-down sends note-on, key-up
 * sends note-off, so a pad set to GATE follows the thumb exactly like REACT
 * does, and a one-shot pad simply ignores the off. Which bank and pad is
 * per-key settings from the layout, so WIN, OOPS and THINK are three keys of
 * this one action pointed at three pads.
 *
 * The key knows nothing about what the pad holds. Its face is the pad's name
 * (or a label from the layout), lit when an SP is on the MIDI bus and dim when
 * it is not — dim means pressing does nothing, same grammar as every OBS key.
 * Whether the SP SOUNDS the note is the unit's business, and Ryan's ear.
 */
@action({ UUID: "com.blessdog.obs-control-room.pad" })
export class Pad extends SingletonAction<PadSettings> {
	private readonly log = streamDeck.logger.createScope("pad");
	private held = new Set<string>();
	private visible = 0;
	private reconcileTimer: NodeJS.Timeout | undefined;

	constructor() {
		super();
		spMidi.on("changed", () => void this.renderAll());
	}

	override onWillAppear(ev: WillAppearEvent<PadSettings>): void {
		this.visible++;
		this.reconcileTimer ??= setInterval(() => spMidi.available(), RECONCILE_MS);
		void this.render(ev.action.id, ev.payload.settings);
	}

	override onWillDisappear(_ev: WillDisappearEvent<PadSettings>): void {
		if (--this.visible <= 0) {
			this.visible = 0;
			if (this.reconcileTimer) {
				clearInterval(this.reconcileTimer);
				this.reconcileTimer = undefined;
			}
		}
	}

	override async onKeyDown(ev: KeyDownEvent<PadSettings>): Promise<void> {
		const { bank, pad } = this.target(ev.payload.settings);
		if (!spMidi.noteOn(bank, pad)) {
			await ev.action.showAlert();
			void this.render(ev.action.id, ev.payload.settings);
			return;
		}
		this.held.add(ev.action.id);
		void this.render(ev.action.id, ev.payload.settings);
	}

	override async onKeyUp(ev: KeyUpEvent<PadSettings>): Promise<void> {
		const { bank, pad } = this.target(ev.payload.settings);
		if (this.held.delete(ev.action.id)) spMidi.noteOff(bank, pad);
		void this.render(ev.action.id, ev.payload.settings);
	}

	private target(s: PadSettings): { bank: number; pad: number } {
		const bank = Math.min(10, Math.max(1, Number(s.bank ?? 1)));
		const pad = Math.min(16, Math.max(1, Number(s.pad ?? 1)));
		return { bank, pad };
	}

	private async render(id: string, s: PadSettings): Promise<void> {
		const { bank, pad } = this.target(s);
		const label = s.label?.trim() || `${bankLetter(bank)}${pad}`;
		const state = !spMidi.available() ? "offline" : this.held.has(id) ? "active" : "idle";
		const uri = face({ state, tint: "sound", label });
		const a = [...this.actions].find((x) => x.id === id);
		if (a) await a.setImage(uri);
	}

	private async renderAll(): Promise<void> {
		for (const a of this.actions) {
			try {
				await this.render(a.id, await a.getSettings());
			} catch (err) {
				this.log.warn(`render failed: ${err}`);
			}
		}
	}
}
