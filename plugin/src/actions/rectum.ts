import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { face, fmtDuration, GLYPHS } from "../key-face";

/**
 * The rectum page — the clipper (`~/projects/rectum`).
 *
 * Record a whole monitor, find the video inside it afterwards. You cannot
 * un-crop a capture, so capture everything and decide framing later; that is
 * why these are LEFT/RIGHT monitor keys and not a draw-a-box key.
 *
 * These keys shell out to rectum's CLI rather than reimplementing anything.
 * The plugin owns the key and its face; rectum owns capture and the library.
 *
 * DOCTRINE (Record key, 2026-08-01 — "the recording button is stuck on"): never
 * act on remembered state. Every press re-reads `rectum status --json` before
 * deciding, and a slow reconcile heals anything that drifts. A key that reports
 * a state the system disagrees with is worse than a key that does nothing.
 */

const RECTUM = join(homedir(), "projects", "rectum");
const RECONCILE_MS = 5_000;
const TICK_MS = 1_000; // elapsed is whole seconds; a faster tick buys nothing

/**
 * A GUI-launched plugin inherits a MINIMAL PATH, so a bare `python3` resolves to
 * Apple's /usr/bin/python3 — which ships no numpy, so `crop` would fail while
 * everything worked perfectly from a terminal. Prefer Homebrew's interpreter and
 * fall back, rather than trusting whatever PATH happens to hold.
 * (rectum itself also repairs PATH so it can find ffmpeg. Both are needed:
 * this picks the interpreter, that one finds the tools.)
 */
const PYTHON =
	["/opt/homebrew/bin/python3", "/usr/local/bin/python3"].find((p) => existsSync(p)) ?? "/usr/bin/python3";

type Status = { recording: boolean; target: string | null; elapsed: number };

function rectum(args: string[], timeoutMs = 120_000): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(
			PYTHON,
			["-m", "rectum", ...args],
			{ cwd: RECTUM, timeout: timeoutMs },
			(err, stdout, stderr) => (err ? reject(new Error(stderr || String(err))) : resolve(stdout)),
		);
	});
}

async function status(): Promise<Status> {
	try {
		return JSON.parse(await rectum(["status", "--json"], 10_000)) as Status;
	} catch {
		// Unreachable rectum reads as "not recording" — the safe assumption,
		// because it makes the next press a START, never a STOP of nothing.
		return { recording: false, target: null, elapsed: 0 };
	}
}

/** LEFT and RIGHT differ only by which monitor they name. */
abstract class MonitorKey extends SingletonAction {
	protected abstract readonly side: "left" | "right";
	private readonly log = streamDeck.logger.createScope("rectum");
	private state: Status = { recording: false, target: null, elapsed: 0 };
	private startedAtMs = 0;
	private visible = 0;
	private timers: NodeJS.Timeout[] = [];

	override onWillAppear(_ev: WillAppearEvent): void {
		this.visible++;
		if (this.visible === 1) {
			this.timers.push(setInterval(() => void this.reconcile(), RECONCILE_MS));
			this.timers.push(setInterval(() => void this.render(), TICK_MS));
		}
		void this.reconcile();
	}

	override onWillDisappear(_ev: WillDisappearEvent): void {
		this.visible = Math.max(0, this.visible - 1);
		if (this.visible === 0) {
			this.timers.forEach(clearInterval);
			this.timers = [];
		}
	}

	private async reconcile(): Promise<void> {
		const next = await status();
		if (next.recording && !this.state.recording) {
			this.startedAtMs = Date.now() - next.elapsed * 1000;
		}
		this.state = next;
		await this.render();
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		const now = await status(); // re-read; never trust what we remember
		try {
			if (now.recording && now.target !== this.side) {
				// One recorder at a time. Stopping someone else's monitor from
				// this key would be a surprise, so refuse and say so.
				await ev.action.showAlert();
				this.state = now;
				await this.render();
				return;
			}
			if (now.recording) {
				this.state = { recording: false, target: null, elapsed: 0 };
				await this.render();
				await rectum(["stop"]); // normalise + hash + file; can take a moment
				await ev.action.showOk();
			} else {
				await rectum(["record", this.side], 15_000);
				this.startedAtMs = Date.now();
				this.state = { recording: true, target: this.side, elapsed: 0 };
				await this.render();
			}
		} catch (err) {
			this.log.error(`rectum ${this.side}: ${String(err)}`);
			await ev.action.showAlert();
		}
		await this.reconcile();
	}

	private async render(): Promise<void> {
		const mine = this.state.recording && this.state.target === this.side;
		const other = this.state.recording && this.state.target !== this.side;
		const label = this.side === "left" ? "LEFT" : "RIGHT";
		const image = mine
			? // State outranks tint: recording is red whatever family it lives in.
				face({
					state: "recording",
					tint: "live",
					glyph: GLYPHS.record,
					sub: fmtDuration(Date.now() - this.startedAtMs),
				})
			: face({
					// Dim means pressing does nothing — literally true here,
					// because the other monitor is already recording.
					state: other ? "offline" : "idle",
					tint: "screen",
					glyph: GLYPHS.record,
					label,
				});
		await this.broadcast(image);
	}

	private async broadcast(image: string): Promise<void> {
		for (const a of this.actions) await a.setImage(image);
	}
}

@action({ UUID: "com.blessdog.obs-control-room.rectum-left" })
export class RectumLeft extends MonitorKey {
	protected readonly side = "left" as const;
}

@action({ UUID: "com.blessdog.obs-control-room.rectum-right" })
export class RectumRight extends MonitorKey {
	protected readonly side = "right" as const;
}

/**
 * Propose the crop for the clip just recorded, and open the preview for Ryan's
 * eyes. Never applies it — a crop is a creative call and the detector can pick
 * the wrong moving region (a scrolling terminal beat a video on 2026-08-02).
 */
@action({ UUID: "com.blessdog.obs-control-room.rectum-crop" })
export class RectumCrop extends SingletonAction {
	private readonly log = streamDeck.logger.createScope("rectum-crop");

	override onWillAppear(_ev: WillAppearEvent): void {
		void this.render(false);
	}

	override async onKeyDown(ev: KeyDownEvent): Promise<void> {
		await this.render(true);
		try {
			await rectum(["crop", "--last"]);
			await ev.action.showOk();
		} catch (err) {
			this.log.error(`crop: ${String(err)}`);
			await ev.action.showAlert(); // nothing moved, or no clips yet
		}
		await this.render(false);
	}

	private async render(busy: boolean): Promise<void> {
		const image = face({
			state: busy ? "active" : "idle",
			tint: "screen",
			glyph: GLYPHS.zoom,
			label: "CROP",
		});
		for (const a of this.actions) await a.setImage(image);
	}
}
