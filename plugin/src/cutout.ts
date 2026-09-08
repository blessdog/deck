import streamDeck from "@elgato/streamdeck";
import { EventEmitter } from "node:events";
import { obs } from "./obs-connection";

/**
 * The cutout latch: the Apple Vision remover ("Mac Vision", obs/lib/cutout.mjs)
 * sitting DISABLED on the shared Camera input. On, every scene that shows the
 * camera — Cam, Screen + Cam, Me + Float, React — becomes a cutout in place;
 * off, the room is back. It is a look, not a scene, so it survives scene
 * changes until someone turns it off: the CUTOUT key, or NORMAL.
 *
 * State follows OBS's own SourceFilterEnableStateChanged event, so the key
 * can never lie about what the filter is doing. Lava Lounge's cutout is a
 * different input (Camera FX) and is not this latch.
 */
export const CUTOUT_SOURCE = "Camera";
export const CUTOUT_FILTER = "Mac Vision";

class CutoutLatch extends EventEmitter<{ changed: [boolean] }> {
	private readonly log = streamDeck.logger.createScope("cutout");
	private latched = false; // not `on`: that name is EventEmitter.on()

	constructor() {
		super();
		obs.on("connected", () => void this.refresh());
		obs.on("disconnected", () => this.set(false));
		obs.on("SourceFilterEnableStateChanged", ({ sourceName, filterName, filterEnabled }) => {
			if (sourceName === CUTOUT_SOURCE && filterName === CUTOUT_FILTER) this.set(filterEnabled);
		});
	}

	get active(): boolean {
		return this.latched;
	}

	async refresh(): Promise<void> {
		if (!obs.connected) return;
		try {
			const { filterEnabled } = await obs.call("GetSourceFilter", { sourceName: CUTOUT_SOURCE, filterName: CUTOUT_FILTER });
			this.set(filterEnabled);
		} catch (err) {
			// No such filter: obs/add-look.mjs cutout has not run in this collection.
			this.log.warn(`no ${CUTOUT_FILTER} on ${CUTOUT_SOURCE}: ${err}`);
			this.set(false);
		}
	}

	/** Flip the filter. Returns the state OBS confirms. */
	async toggle(): Promise<boolean> {
		return this.apply(!this.latched);
	}

	async apply(enabled: boolean): Promise<boolean> {
		await obs.call("SetSourceFilterEnabled", { sourceName: CUTOUT_SOURCE, filterName: CUTOUT_FILTER, filterEnabled: enabled });
		this.set(enabled);
		return enabled;
	}

	private set(on: boolean): void {
		if (this.latched === on) return;
		this.latched = on;
		this.emit("changed", on);
	}
}

export const cutout = new CutoutLatch();
