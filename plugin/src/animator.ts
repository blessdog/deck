/**
 * A frame clock for a key: repaint the same key fast enough to read as motion.
 * The only animation path the Stream Deck SDK gives us is pushing successive
 * images via setImage — animated GIF/SVG freeze on frame one. So we render a
 * fresh SVG each tick and broadcast it to every visible copy of the action.
 *
 * Two disciplines the SDK punishes you for skipping:
 *   - dedupe: never resubmit an identical frame (the WS + USB pipe is shared by
 *     all 32 keys), so we skip the push when the frame string is unchanged;
 *   - stop when hidden: the owner must call stop() from onWillDisappear, or the
 *     timer runs forever repainting a key nobody can see.
 */
export class KeyAnimator {
	private timer: NodeJS.Timeout | undefined;
	private startedAt = 0;
	private last: string | undefined;

	constructor(
		/** Render the frame for a given elapsed-since-play time (ms) → data URI. */
		private readonly frame: (elapsedMs: number) => string,
		/** Push one frame to every visible instance of the owning action. */
		private readonly broadcast: (uri: string) => void,
		private readonly intervalMs: number,
	) {}

	get playing(): boolean {
		return this.timer !== undefined;
	}

	play(): void {
		if (this.timer) return; // idempotent — safe to call on every willAppear
		this.startedAt = Date.now();
		const tick = () => {
			const uri = this.frame(Date.now() - this.startedAt);
			if (uri !== this.last) {
				this.last = uri;
				this.broadcast(uri);
			}
		};
		tick(); // paint frame 0 now, don't wait one interval
		this.timer = setInterval(tick, this.intervalMs);
	}

	stop(finalUri?: string): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
		this.last = undefined;
		if (finalUri) this.broadcast(finalUri);
	}
}
