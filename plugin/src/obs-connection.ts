import streamDeck from "@elgato/streamdeck";
import OBSWebSocket from "obs-websocket-js";
import { EventEmitter } from "node:events";
import { execFile, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Spawned by the Stream Deck app (launchd env): PATH is minimal, so every
// external binary is called by absolute path.
const OPEN = "/usr/bin/open";
const PYTHON = "/usr/bin/python3";
const PGREP = "/usr/bin/pgrep";

const HOME = process.env.HOME ?? "/Users/SSDrive";
const OBS_WS_CONFIG = join(
	HOME,
	"Library/Application Support/obs-studio/plugin_config/obs-websocket/config.json",
);

export const COLLECTION = "Control Room";
export const SCENES = {
	startingSoon: "Starting Soon",
	screenLeft: "Screen L",
	screenRight: "Screen R",
	cam: "Cam",
	camCutout: "Cam Cutout",
	screenCam: "Screen + Cam",
	meFloat: "Me + Float",
	brb: "BRB",
	ending: "Ending",
} as const;

/** `x` is the display's left edge in global desktop space — smallest x is the
 *  physically leftmost screen. Left/right is always computed from this, never
 *  hard-coded, so adding a third monitor doesn't make the keys lie. */
export type DisplayInfo = { id: number; uuid: string; builtin: boolean; x: number };

export type ObsEvents = {
	connected: [];
	disconnected: [];
	StreamStateChanged: [{ outputActive: boolean; outputState: string }];
	RecordStateChanged: [{ outputActive: boolean; outputState: string }];
	VirtualcamStateChanged: [{ outputActive: boolean; outputState: string }];
	CurrentProgramSceneChanged: [{ sceneName: string }];
	InputSettingsChanged: [{ inputName: string; inputSettings: Record<string, unknown> }];
	InputMuteStateChanged: [{ inputName: string; inputMuted: boolean }];
	InputVolumeChanged: [{ inputName: string; inputVolumeMul: number; inputVolumeDb: number }];
};

const FORWARDED = [
	"StreamStateChanged",
	"RecordStateChanged",
	"VirtualcamStateChanged",
	"CurrentProgramSceneChanged",
	"InputSettingsChanged",
	"InputMuteStateChanged",
	"InputVolumeChanged",
] as const;

const RETRY_MS = 3_000;
const NOT_READY = 207; // obs-websocket: socket is up before OBS finishes init

class OBSConnection extends EventEmitter<ObsEvents> {
	private readonly obs = new OBSWebSocket();
	private readonly log = streamDeck.logger.createScope("obs");
	private retryTimer: NodeJS.Timeout | undefined;
	private connecting = false;
	connected = false;

	constructor() {
		super();
		this.setMaxListeners(50);
		this.obs.on("ConnectionClosed", () => this.handleClosed());
		for (const evt of FORWARDED) {
			// obs-websocket-js event names/payloads pass straight through
			(this.obs as any).on(evt, (data: any) => this.emit(evt, data));
		}
	}

	/** Begin the persistent connect/reconnect loop (never rejects). */
	start(): void {
		void this.tryConnect();
	}

	private wsConfig(): { port: number; password: string } {
		const cfg = JSON.parse(readFileSync(OBS_WS_CONFIG, "utf8"));
		return { port: cfg.server_port, password: cfg.server_password };
	}

	private async tryConnect(): Promise<void> {
		if (this.connected || this.connecting) return;
		this.connecting = true;
		try {
			const { port, password } = this.wsConfig();
			await this.obs.connect(`ws://127.0.0.1:${port}`, password);
			// Poll until OBS answers real requests (error 207 while initializing).
			for (;;) {
				try {
					await this.obs.call("GetSceneCollectionList");
					break;
				} catch (err: any) {
					if (err?.code !== NOT_READY) throw err;
					await sleep(500);
				}
			}
			this.connected = true;
			this.log.info("Connected to OBS");
			this.emit("connected");
		} catch {
			this.scheduleRetry();
		} finally {
			this.connecting = false;
		}
	}

	private handleClosed(): void {
		if (this.connected) {
			this.connected = false;
			this.log.info("OBS connection closed");
			this.emit("disconnected");
		}
		this.scheduleRetry();
	}

	private scheduleRetry(): void {
		if (this.retryTimer) return;
		this.retryTimer = setTimeout(() => {
			this.retryTimer = undefined;
			void this.tryConnect();
		}, RETRY_MS);
	}

	/** Force an immediate reconnect attempt (e.g. after system wake). */
	poke(): void {
		if (this.retryTimer) {
			clearTimeout(this.retryTimer);
			this.retryTimer = undefined;
		}
		void this.tryConnect();
	}

	call<T = any>(request: string, data?: Record<string, unknown>): Promise<T> {
		return (this.obs as any).call(request, data);
	}

	obsProcessRunning(): boolean {
		try {
			execFileSync(PGREP, ["-x", "OBS"], { stdio: "ignore" });
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * From any state to "connected, Control Room loaded": launches OBS if the
	 * process is dead, then waits for the reconnect loop to land.
	 */
	async ensureOBS(timeoutMs = 45_000): Promise<void> {
		if (this.connected) return;
		if (!this.obsProcessRunning()) {
			this.log.info("Launching OBS");
			execFile(OPEN, ["-a", "OBS", "--args", "--collection", COLLECTION, "--scene", SCENES.startingSoon]);
		}
		const deadline = Date.now() + timeoutMs;
		while (!this.connected) {
			if (Date.now() > deadline) throw new Error("OBS did not come up in time");
			this.poke();
			await sleep(1_000);
		}
	}

	/**
	 * Displays from CoreGraphics (obs-websocket display enumeration hangs on
	 * OBS 32.1.x). The helper .py ships in the .sdPlugin root, next to bin/.
	 */
	displayUUIDs(): DisplayInfo[] {
		const script = join(dirname(dirname(fileURLToPath(import.meta.url))), "display-uuids.py");
		return JSON.parse(execFileSync(PYTHON, [script], { encoding: "utf8" }));
	}

	private displayCache: DisplayInfo[] | undefined;

	/**
	 * Displays left-to-right, cached — key faces redraw often and spawning
	 * python per repaint would be absurd. Call `forgetDisplays()` when the
	 * arrangement could have changed (wake, reconnect).
	 */
	displays(): DisplayInfo[] {
		if (!this.displayCache) {
			try {
				this.displayCache = this.displayUUIDs().sort((a, b) => a.x - b.x);
			} catch {
				this.displayCache = [];
			}
		}
		return this.displayCache;
	}

	forgetDisplays(): void {
		this.displayCache = undefined;
	}
}

export const obs = new OBSConnection();

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
