import streamDeck from "@elgato/streamdeck";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";

/**
 * The one MIDI output to the SP-404MKII, shared by every pad key.
 *
 * PRIOR ART: @julusian/midi (RtMidi with prebuilt CoreMIDI binaries). Measured
 * 2026-09-08 under the Stream Deck app's own Node 24.13.1: a note-on/off pair
 * costs 0.05 ms in-process, against ~90 ms per spawn of the sendmidi CLI. A
 * sound hit on a key has to feel like a pad, so the library wins.
 *
 * The module is a native addon, and it is loaded LAZILY inside a try/catch:
 * if the .node binary ever fails to resolve, the pad keys go dim with the
 * reason in the log, and RECORD, REACT and every scene key keep working.
 *
 * Pad-to-note map, MEASURED off the unit 2026-09-08 (SP-404 repo,
 * knowledge/pad-to-note-map-is-top-row-first): channel = bank (A is 1),
 * notes run from the top row down — pad 13 is 36, pad 1 is 48. The unit is in
 * Roland's MIDI Mode A. This formula is the only place that map lives.
 */
export const noteForPad = (pad: number): number => {
	const i = pad - 1;
	return 48 - 4 * Math.floor(i / 4) + (i % 4);
};

export const BANKS = "ABCDEFGHIJ";
export const bankLetter = (bank: number): string => BANKS[bank - 1] ?? "?";

const PORT_MATCH = "SP-404MKII";

type Output = {
	getPortCount(): number;
	getPortName(i: number): string;
	openPort(i: number): void;
	closePort(): void;
	isPortOpen(): boolean;
	sendMessage(message: number[]): void;
};
type MidiLib = { Output: new () => Output };

const require = createRequire(import.meta.url);

class SPMidi extends EventEmitter<{ changed: [] }> {
	private readonly log = streamDeck.logger.createScope("midi");
	private lib: MidiLib | undefined;
	private loadError: string | undefined;
	private out: Output | undefined;
	private wasAvailable: boolean | undefined;

	private load(): MidiLib | undefined {
		if (this.lib || this.loadError) return this.lib;
		try {
			this.lib = require("@julusian/midi") as MidiLib;
			this.log.info("@julusian/midi loaded");
		} catch (err) {
			this.loadError = String(err);
			this.log.error(`@julusian/midi failed to load — pad keys are dead: ${this.loadError}`);
		}
		return this.lib;
	}

	private portIndex(out: Output): number {
		for (let i = 0; i < out.getPortCount(); i++) {
			if (out.getPortName(i).includes(PORT_MATCH)) return i;
		}
		return -1;
	}

	/** Is there an SP on the bus right now? Enumerates every call; cheap. */
	available(): boolean {
		const lib = this.load();
		if (!lib) return this.note(false);
		const probe = this.out ?? new lib.Output();
		const found = this.portIndex(probe) >= 0;
		if (probe !== this.out) probe.closePort();
		return this.note(found);
	}

	private note(available: boolean): boolean {
		if (this.wasAvailable !== available) {
			this.wasAvailable = available;
			this.emit("changed");
		}
		return available;
	}

	private open(): Output | undefined {
		const lib = this.load();
		if (!lib) return undefined;
		if (this.out?.isPortOpen()) return this.out;
		const out = this.out ?? new lib.Output();
		const i = this.portIndex(out);
		if (i < 0) {
			this.note(false);
			return undefined;
		}
		out.openPort(i);
		this.out = out;
		this.log.info(`opened ${out.getPortName(i)}`);
		this.note(true);
		return out;
	}

	private close(): void {
		try {
			this.out?.closePort();
		} catch {
			/* already gone */
		}
		this.out = undefined;
	}

	/**
	 * Send one message. A vanished port (unit power-cycled or unplugged) is
	 * closed, re-enumerated and reopened once; a second failure is reported.
	 */
	send(message: number[]): boolean {
		for (let attempt = 0; attempt < 2; attempt++) {
			const out = this.open();
			if (!out) return false;
			try {
				out.sendMessage(message);
				return true;
			} catch (err) {
				this.log.warn(`send failed (${attempt === 0 ? "reopening" : "giving up"}): ${err}`);
				this.close();
			}
		}
		this.note(false);
		return false;
	}

	noteOn(bank: number, pad: number, velocity = 127): boolean {
		return this.send([0x90 | (bank - 1), noteForPad(pad), velocity]);
	}

	noteOff(bank: number, pad: number): boolean {
		return this.send([0x80 | (bank - 1), noteForPad(pad), 0]);
	}
}

export const spMidi = new SPMidi();
