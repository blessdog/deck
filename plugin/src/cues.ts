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

class Cues extends EventEmitter<{ changed: [Cue | undefined] }> {
	private readonly log = streamDeck.logger.createScope("cues");
	private cue: Cue | undefined;

	constructor() {
		super();
		obs.on("disconnected", () => this.clear("disconnected"));
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
		await obs.call("SetCurrentProgramScene", { sceneName: scene });
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
}

export const cues = new Cues();
