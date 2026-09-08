import streamDeck from "@elgato/streamdeck";
import { EventEmitter } from "node:events";
import { obs } from "./obs-connection";

/**
 * The one place a performance cue keeps what it must give back.
 *
 * A cue (REACT now; TAKEAWAY and CHAPTER later) borrows the program — it puts
 * its own scene up and promises to restore the shot Ryan was on. That promise
 * is state, and state that lives inside one action cannot be cancelled by
 * another. NORMAL exists precisely to cancel any cue from anywhere, so the
 * saved shot lives here, owned by nobody, and every cue reads and writes it.
 *
 * At most one cue is live. Beginning a second one while the first is live
 * keeps the FIRST cue's saved shot: the "normal" Ryan wants back is the shot
 * he was on before any cue started, never the middle of another cue.
 *
 * Restoration is only ever CONDITIONAL. If the program is not on the cue's
 * scene any more — Ryan pressed a scene key mid-reaction — the cue is simply
 * dropped. Dragging him back to a shot he already left would be the timer
 * bug the plan warns about, with a key press instead of a timer.
 */
export type Cue = {
	owner: string;
	scene: string;
	savedScene: string;
	savedTransition: string;
};

/** A nested overlay scene currently shown in some program scene. */
export type Overlay = { owner: string; scene: string; sceneItemId: number; timer?: NodeJS.Timeout };

class Cues extends EventEmitter<{ changed: [Cue | undefined] }> {
	private readonly log = streamDeck.logger.createScope("cues");
	private cue: Cue | undefined;
	private readonly overlays = new Map<string, Overlay>();

	constructor() {
		super();
		obs.on("disconnected", () => {
			this.clear("disconnected");
			this.forgetOverlays("disconnected");
		});
		// Any scene change that is not onto the cue's own scene means someone
		// else took the program. The cue is over; nothing to restore.
		obs.on("CurrentProgramSceneChanged", ({ sceneName }) => {
			if (this.cue && sceneName !== this.cue.scene) this.clear(`program moved to ${sceneName}`);
		});
	}

	get active(): Cue | undefined {
		return this.cue;
	}

	/**
	 * Capture the shot and transition, then put the cue's scene on program.
	 * Returns the cue that now holds the program.
	 */
	async begin(owner: string, scene: string): Promise<Cue> {
		if (this.cue) {
			if (this.cue.scene === scene) return this.cue; // already up (key repeat)
			// Nested cue: keep the original saved shot, change what is on program.
			this.cue = { ...this.cue, owner, scene };
		} else {
			const [{ currentProgramSceneName }, { transitionName }] = await Promise.all([
				obs.call("GetCurrentProgramScene"),
				obs.call("GetCurrentSceneTransition"),
			]);
			if (currentProgramSceneName === scene) {
				// Program is already the cue scene (a previous session died
				// mid-hold); there is no "normal" to save, so refuse to
				// remember this as one.
				throw new Error(`${scene} is already on program; nothing to return to`);
			}
			this.cue = { owner, scene, savedScene: currentProgramSceneName, savedTransition: transitionName };
		}
		this.emit("changed", this.cue);
		try {
			await obs.call("SetCurrentProgramScene", { sceneName: scene });
		} catch (err) {
			// The scene never reached program (missing scene, OBS mid-reload):
			// a cue that holds nothing must not light NORMAL or REACT.
			this.clear(`switch to ${scene} failed: ${err}`);
			throw err;
		}
		this.log.info(`${owner}: ${this.cue.savedScene} -> ${scene}`);
		return this.cue;
	}

	/**
	 * Give the program back. True if a restore actually happened; false if
	 * there was no cue, or the program had already moved on.
	 */
	async restore(reason: string): Promise<boolean> {
		const cue = this.cue;
		if (!cue) return false;
		// Clear BEFORE switching so our own CurrentProgramSceneChanged does
		// not read as "someone else took the program".
		this.clear(reason);
		const { currentProgramSceneName } = await obs.call("GetCurrentProgramScene");
		if (currentProgramSceneName !== cue.scene) {
			this.log.info(`${reason}: program is on ${currentProgramSceneName}, not ${cue.scene}; nothing to restore`);
			return false;
		}
		const { transitionName } = await obs.call("GetCurrentSceneTransition");
		if (transitionName !== cue.savedTransition) {
			await obs.call("SetCurrentSceneTransition", { transitionName: cue.savedTransition });
		}
		await obs.call("SetCurrentProgramScene", { sceneName: cue.savedScene });
		this.log.info(`${reason}: ${cue.scene} -> ${cue.savedScene}`);
		return true;
	}

	clear(reason: string): void {
		if (!this.cue) return;
		this.log.info(`cue ${this.cue.owner} cleared: ${reason}`);
		this.cue = undefined;
		this.emit("changed", undefined);
	}

	// ------------------------------------------------------------ overlays
	// TAKEAWAY and CHAPTER do not borrow the program; they put a nested scene
	// item on top of it for a while. The item lives in the scene that was on
	// program at press time, and that is where it is hidden again — even if
	// Ryan has moved to another scene by then, so nothing is left lit behind.

	overlayActive(owner: string): boolean {
		return this.overlays.has(owner);
	}

	get anyOverlay(): boolean {
		return this.overlays.size > 0;
	}

	/**
	 * Show `overlayScene` (a nested scene item) in the current program scene.
	 * Showing again while shown hides first, so media restarts and a timer
	 * restarts instead of stacking. `holdMs` hides it automatically; omit for
	 * "until told" (a media source ending, or NORMAL).
	 */
	async showOverlay(owner: string, overlayScene: string, holdMs?: number): Promise<void> {
		await this.hideOverlay(owner, "restart");
		const { currentProgramSceneName: scene } = await obs.call("GetCurrentProgramScene");
		let sceneItemId: number;
		try {
			({ sceneItemId } = await obs.call("GetSceneItemId", { sceneName: scene, sourceName: overlayScene }));
		} catch {
			throw new Error(`${scene} has no ${overlayScene} overlay (run obs/setup-cues.mjs)`);
		}
		await obs.call("SetSceneItemEnabled", { sceneName: scene, sceneItemId, sceneItemEnabled: true });
		const overlay: Overlay = { owner, scene, sceneItemId };
		if (holdMs) overlay.timer = setTimeout(() => void this.hideOverlay(owner, `${holdMs} ms up`), holdMs);
		this.overlays.set(owner, overlay);
		this.log.info(`${owner}: ${overlayScene} up in ${scene}`);
		this.emit("changed", this.cue);
	}

	async hideOverlay(owner: string, reason: string): Promise<void> {
		const o = this.overlays.get(owner);
		if (!o) return;
		if (o.timer) clearTimeout(o.timer);
		this.overlays.delete(owner);
		this.emit("changed", this.cue);
		try {
			await obs.call("SetSceneItemEnabled", { sceneName: o.scene, sceneItemId: o.sceneItemId, sceneItemEnabled: false });
			this.log.info(`${owner}: down (${reason})`);
		} catch (err) {
			this.log.warn(`${owner}: could not hide in ${o.scene}: ${err}`);
		}
	}

	async hideAllOverlays(reason: string): Promise<void> {
		for (const owner of [...this.overlays.keys()]) await this.hideOverlay(owner, reason);
	}

	/** OBS is gone: nothing to hide, just stop believing anything is up. */
	private forgetOverlays(reason: string): void {
		for (const o of this.overlays.values()) if (o.timer) clearTimeout(o.timer);
		if (this.overlays.size) this.log.info(`overlays forgotten: ${reason}`);
		this.overlays.clear();
		this.emit("changed", this.cue);
	}
}

export const cues = new Cues();
