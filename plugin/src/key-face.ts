/**
 * One SVG generator for every key face, so the deck reads as one system.
 * 144x144 (the @2x key size); returned as an SVG data URI for setImage.
 *
 * FACE GRAMMAR — measured off Elgato's own shipped OBS artwork (2026-08-01),
 * and confirmed against Aetheon's paid OBS profile pack and Elgato's icon packs:
 *
 *   state    = the WHOLE KEY's background colour
 *   identity = one line-art glyph, white, centred
 *   text     = only when it is a number that changes (elapsed, %, device name)
 *
 * That ordering is the perception hierarchy, not a taste: colour across a whole
 * key is caught in peripheral vision, a glyph needs a glance, text needs a full
 * second of focus. The previous version inverted it — a permanently dark key
 * with a small recoloured glyph — which is why the deck didn't read at arm's
 * length. Never instructional text; it's a button, you press it.
 *
 * Elgato's tiles are FULL BLEED — no rounded rect in the artwork; the app and
 * the physical key do the rounding. Drawing our own corner radius is what made
 * ours look subtly wrong next to theirs.
 */

/** What a key is doing right now. Drives tile + ink together, always. */
export type KeyState = "offline" | "idle" | "active" | "recording" | "alert";

/** Tile = the whole key. Elgato's measured values for idle/active. */
const TILE: Record<KeyState, string> = {
	offline: "#161d1d", // OBS is down — reads as unavailable, not broken
	idle: "#263838", // measured: Elgato inactive
	active: "#5e8b8b", // measured: Elgato active teal
	recording: "#8e2118", // louder than Elgato's — recording is the one to never miss
	alert: "#8a6a12",
};

/** Ink = the glyph and any headline text, on top of the tile. */
const INK: Record<KeyState, string> = {
	offline: "#404c4c",
	idle: "#979797", // measured: Elgato inactive icon
	active: "#efefef", // measured: Elgato active icon
	recording: "#ffffff",
	alert: "#ffffff",
};

/** The data line — deliberately quieter than the glyph it sits under. */
const DATA: Record<KeyState, string> = {
	offline: "#384242",
	idle: "#7d8f8f",
	active: "#d4e3e3",
	recording: "#ffc4bc",
	alert: "#f0dca8",
};

/** Kept for the record key's live core, which is its own thing. */
export const COLORS = {
	live: "#ff2b00", // measured: Elgato's record red
	stream: "#04c84f", // measured: Elgato's stream green
} as const;

/**
 * Filled glyph paths, drawn in a 144x144 viewBox, visually centred on (72,66).
 * Solid rather than thin-stroked on purpose: at 72 physical px, across a desk,
 * mass reads and hairlines disappear. Elgato's own record glyph is solid too.
 */
export const GLYPHS = {
	house: "M72 26 L120 68 H104 V112 H82 V86 H62 V112 H40 V68 H24 Z",
	record: "M72 66 m-26 0 a26 26 0 1 0 52 0 a26 26 0 1 0 -52 0",
	stop: "M46 40 h52 a8 8 0 0 1 8 8 v36 a8 8 0 0 1 -8 8 H46 a8 8 0 0 1 -8 -8 V48 a8 8 0 0 1 8 -8 Z",
	mark: "M50 26 h10 v86 h-10 Z M60 30 h44 l-12 18 12 18 H60 Z",
	play: "M54 38 L106 66 L54 94 Z",
	pause: "M48 36 h16 v60 H48 Z M80 36 h16 v60 H80 Z",
	mic: "M58 40 a14 14 0 0 1 28 0 v24 a14 14 0 0 1 -28 0 Z M46 64 A26 26 0 0 0 98 64 L92 64 A20 20 0 0 1 52 64 Z M68 90 h8 v14 h-8 Z M56 104 h32 v8 H56 Z",
	micMuted:
		"M58 40 a14 14 0 0 1 28 0 v24 a14 14 0 0 1 -28 0 Z M46 64 A26 26 0 0 0 98 64 L92 64 A20 20 0 0 1 52 64 Z M68 90 h8 v14 h-8 Z M56 104 h32 v8 H56 Z M38 26 L116 100 L108 108 L30 34 Z",
	stream:
		"M72 56 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M68 66 L60 108 H84 L76 66 Z M87.4 37.6 A24 24 0 0 1 87.4 74.4 L82.3 68.3 A16 16 0 0 0 82.3 43.7 Z M96.4 26.9 A38 38 0 0 1 96.4 85.1 L91.3 79 A30 30 0 0 0 91.3 33 Z M56.6 37.6 A24 24 0 0 0 56.6 74.4 L61.7 68.3 A16 16 0 0 1 61.7 43.7 Z M47.6 26.9 A38 38 0 0 0 47.6 85.1 L52.7 79 A30 30 0 0 1 52.7 33 Z",
	camera:
		"M28 44 h50 a10 10 0 0 1 10 10 v24 a10 10 0 0 1 -10 10 H28 a10 10 0 0 1 -10 -10 V54 a10 10 0 0 1 10 -10 Z M94 58 L124 40 v56 L94 78 Z",
	/** A person, shoulders up — the cutout / talking-head keys. */
	person:
		"M72 50 m-17 0 a17 17 0 1 0 34 0 a17 17 0 1 0 -34 0 M40 108 a32 30 0 0 1 64 0 Z",
	/** A single display on a stand — generic screen. */
	screen:
		"M24 30 h96 a8 8 0 0 1 8 8 v46 a8 8 0 0 1 -8 8 H24 a8 8 0 0 1 -8 -8 V38 a8 8 0 0 1 8 -8 Z M62 92 h20 v10 h-20 Z M46 102 h52 v8 H46 Z",
	/** Hourglass — the show hasn't started. */
	hourglass:
		"M44 24 h56 v10 H44 Z M44 98 h56 v10 H44 Z M50 34 h44 L72 66 Z M72 66 L94 98 H50 Z",
	/** Skip-to-end — double chevron into a bar. Reads as "wrap it up". */
	ending: "M28 36 L66 66 L28 96 Z M70 36 L108 66 L70 96 Z M112 34 h12 v64 h-12 Z",
	/** Lava lamp. */
	lamp: "M60 22 h24 v8 H60 Z M64 30 h16 l10 62 H54 Z M50 100 h44 v10 H50 Z M72 46 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M66 70 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0",
	/** Two people — a meeting. Deliberately NOT a camcorder: Meeting Mode sat
	 *  next to Camera Picker wearing the same glyph, so neither key could be
	 *  told from the other at a glance. */
	meeting:
		"M54 44 m-15 0 a15 15 0 1 0 30 0 a15 15 0 1 0 -30 0 M22 94 a32 28 0 0 1 64 0 Z M99 50 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 M78 92 a23 21 0 0 1 46 0 Z",
	/** Magnifier — zoom to cursor. */
	zoom: "M64 22 a34 34 0 1 0 0 68 a34 34 0 1 0 0 -68 Z M64 34 a22 22 0 1 1 0 44 a22 22 0 1 1 0 -44 Z M88 82 l10 -10 l28 28 l-10 10 Z",
} as const;

export type Face = {
	/** What this key is doing. Always required — it paints the whole tile. */
	state: KeyState;
	/** A glyph from GLYPHS (or any path data in the same 144 viewBox). */
	glyph?: string;
	/** Raw SVG fragment, for composite art like the monitor diagram. */
	art?: string;
	/** A word that IS the key's content — a scene name, or a big readout. */
	label?: string;
	/** Bottom line — live data only (timer, %, device name). Never a hint. */
	sub?: string;
};

const esc = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Rough width estimate, for shrinking a label until it fits the key. */
const fitSize = (s: string, max: number, cap = 128) => {
	let size = max;
	while (size > 11 && s.length * size * 0.58 > cap) size -= 1;
	return size;
};

export function face({ state, glyph, art, label, sub }: Face): string {
	const ink = INK[state];
	const body: string[] = [`<rect width="144" height="144" fill="${TILE[state]}"/>`];

	const symbol = art ?? (glyph ? `<path d="${glyph}" fill="${ink}"/>` : undefined);
	const line = sub ?? label;

	if (symbol) {
		// Glyph fills the key when it's the whole face; sits up when a line
		// shares the key with it.
		const scale = line ? 0.92 : 1.25;
		const cy = line ? 54 : 72;
		body.push(
			`<g transform="translate(72 ${cy}) scale(${scale}) translate(-72 -66)">${symbol}</g>`,
		);
		if (line) {
			const size = fitSize(line, sub ? 21 : 22);
			body.push(
				`<text x="72" y="126" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${sub ? 400 : 600}" fill="${sub ? DATA[state] : ink}" text-anchor="middle">${esc(line)}</text>`,
			);
		}
	} else if (label) {
		// Text-only key: the label IS the content (status readout, device name).
		const size = fitSize(label, label.length <= 3 ? 52 : 34);
		body.push(
			`<text x="72" y="${sub ? 74 : 84}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="700" fill="${ink}" text-anchor="middle">${esc(label)}</text>`,
		);
		if (sub) {
			body.push(
				`<text x="72" y="110" font-family="Helvetica, Arial, sans-serif" font-size="${fitSize(sub, 24)}" fill="${DATA[state]}" text-anchor="middle">${esc(sub)}</text>`,
			);
		}
	}

	return svg(body.join(""));
}

/**
 * The power symbol — a broken ring with a bar through the top. Stroked rather
 * than filled, which is why it's art and not a GLYPHS entry.
 *
 * This is what the OBS key wears when OBS is down. It used to say "OFFLINE" on
 * a dimmed tile, which read as "dead, nothing to see" — when in fact it is the
 * single most actionable key on the deck, because pressing it launches OBS.
 * Dim means pressing does nothing; this key does something, so it stays lit.
 */
export function powerArt(state: KeyState): string {
	const ink = INK[state];
	return (
		`<path d="M50.8 44.8 A30 30 0 1 0 93.2 44.8" fill="none" stroke="${ink}" stroke-width="11" stroke-linecap="round"/>` +
		`<rect x="66" y="22" width="12" height="42" rx="6" fill="${ink}"/>`
	);
}

/**
 * Screen-plus-camera: a monitor knocked out in the tile colour with a person
 * sitting inside it. Needs to be composite art rather than a single glyph —
 * a same-coloured person drawn on top of a solid monitor is invisible, which
 * is exactly how the first attempt failed.
 */
export function screenCamArt(state: KeyState): string {
	const ink = INK[state];
	const tile = TILE[state];
	return [
		`<rect x="14" y="26" width="116" height="66" rx="9" fill="${ink}"/>`,
		`<rect x="23" y="35" width="98" height="48" rx="4" fill="${tile}"/>`,
		`<rect x="62" y="96" width="20" height="9" fill="${ink}"/>`,
		`<rect x="42" y="105" width="60" height="9" rx="4" fill="${ink}"/>`,
		`<circle cx="101" cy="55" r="9" fill="${ink}"/>`,
		`<path d="M85 83 a16 15 0 0 1 32 0 Z" fill="${ink}"/>`,
	].join("");
}

/**
 * The monitor-arrangement glyph: draws Ryan's ACTUAL displays as a row of
 * screens, left-to-right, with the one this key shares filled solid and the
 * others outlined. Sized so 1..4 displays all fit the key.
 *
 * This is the answer to "I want the key to show what monitor I'm on" — the key
 * is a picture of the desk, not the words SCREEN L. It stays honest when a
 * third monitor arrives because the caller derives order from x-origin.
 */
export function monitorsArt(count: number, activeIndex: number, state: KeyState): string {
	const ink = INK[state];
	const n = Math.max(1, Math.min(count, 4));
	const gap = n <= 2 ? 12 : 9;
	const w = Math.floor((116 - gap * (n - 1)) / n);
	const h = Math.round(w * 0.62);
	const x0 = 72 - (n * w + (n - 1) * gap) / 2;
	const y = 66 - h / 2;

	const parts: string[] = [];
	for (let i = 0; i < n; i++) {
		const x = x0 + i * (w + gap);
		if (i === activeIndex) {
			parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${ink}"/>`);
		} else {
			parts.push(
				`<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" rx="3" fill="none" stroke="${ink}" stroke-width="4" opacity="0.5"/>`,
			);
		}
	}
	return parts.join("");
}

function svg(inner: string): string {
	return `data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">${inner}</svg>`,
	)}`;
}

export function fmtDuration(ms: number): string {
	const total = Math.floor(ms / 1000);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const mm = String(m).padStart(2, "0");
	const ss = String(s).padStart(2, "0");
	return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/**
 * The record key, its own face because it's the one that breathes. Idle: a
 * plain circle on a normal tile. Recording: the whole key goes red and a bright
 * core pulses on a ~1.3s sine with the elapsed time under it — so a glance from
 * across the room says "yes, this is rolling". `t` is the animation clock (ms
 * since the pulse started); static callers omit it.
 */
export function recordFace(opts: {
	connected: boolean;
	recording: boolean;
	elapsedMs?: number;
	/** Animation clock in ms; drives the pulse. Omit for a still frame. */
	t?: number;
	/** One-off status line when idle (e.g. "starting OBS"). */
	note?: string;
}): string {
	const { connected, recording, elapsedMs = 0, t = 0, note } = opts;
	const state: KeyState = recording ? "recording" : connected ? "idle" : "offline";
	const body: string[] = [`<rect width="144" height="144" fill="${TILE[state]}"/>`];

	if (recording) {
		const phase = (Math.sin((t / 1300) * Math.PI * 2) + 1) / 2; // ~1.3s breath
		const coreR = 24 + 4 * phase;
		const glowR = coreR + 10 + 12 * phase;
		body.push(
			`<circle cx="72" cy="58" r="${glowR.toFixed(1)}" fill="#ffffff" opacity="${(0.08 + 0.12 * phase).toFixed(2)}"/>`,
			`<circle cx="72" cy="58" r="${coreR.toFixed(1)}" fill="#ffffff"/>`,
			`<circle cx="72" cy="58" r="${(coreR - 7).toFixed(1)}" fill="${COLORS.live}" opacity="${(0.75 + 0.25 * phase).toFixed(2)}"/>`,
		);
	} else {
		body.push(`<circle cx="72" cy="${note ? 58 : 66}" r="27" fill="${INK[state]}"/>`);
	}

	const line = recording ? fmtDuration(elapsedMs) : note;
	if (line) {
		body.push(
			`<text x="72" y="126" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="${DATA[state]}" text-anchor="middle">${esc(line)}</text>`,
		);
	}
	return svg(body.join(""));
}
