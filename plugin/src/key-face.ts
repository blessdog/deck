/**
 * One SVG generator for every key face, so the deck reads as one system.
 * 144x144 (the @2x key size); returned as an SVG data URI for setImage.
 *
 * FACE GRAMMAR — the structure came from measuring Elgato's own shipped OBS
 * artwork (2026-08-01), the colour is ours:
 *
 *   state  = the WHOLE KEY's background          (caught in peripheral vision)
 *   tint   = which FAMILY the key belongs to     (learned as zones by the hand)
 *   glyph  = what the key is                     (needs a glance)
 *   text   = only when it's a number that changes (needs a full second)
 *
 * That ordering is the perception hierarchy, not taste. The version before this
 * put state on a small glyph floating in a permanently dark key, which is why
 * the deck didn't read at arm's length.
 *
 * WHY TINTS. Elgato's palette is a muted grey-teal because it has to sit under
 * every plugin on the store. Ours only has to sit under Ryan's hands, so each
 * family gets a hue — cyan screens, violet camera looks, blue show-bracket,
 * amber mark, green mic, red record. This is not decoration: it means a glance
 * finds the right block of keys before you've read a single icon, which is the
 * same trick the paid profiles use. (Ryan, 2026-08-01: "what's up with the
 * grayscale? make them way cooler than they are.")
 *
 * State always outranks tint: recording is red and alert is amber no matter
 * which family the key belongs to, because those two must never be missable.
 *
 * Tiles are full bleed with no corner radius — the app and the physical key do
 * the rounding, and drawing our own made ours look subtly wrong next to Elgato's.
 */

/** What a key is doing right now. Drives the whole tile, always. */
export type KeyState = "offline" | "idle" | "active" | "recording" | "alert";

/** Which family a key belongs to. Read as zones across the deck. */
export const TINTS = {
	neutral: "#5eead4",
	screen: "#22d3ee", // cyan — anything that shares a display
	camera: "#a78bfa", // violet — anything that shows Ryan
	bracket: "#60a5fa", // blue — top and tail of a session
	mark: "#fbbf24", // amber — flag this moment
	mic: "#34d399", // green — audio is live
	warm: "#fb7185", // rose — the lounge
	live: "#ff2d55", // red — recording
} as const;
export type Tint = keyof typeof TINTS;

const chan = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
	const [x, y] = [chan(a), chan(b)];
	return (
		"#" +
		x
			.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0"))
			.join("")
	);
};

const INKY = "#05070c";
const WHITE = "#ffffff";

/** sRGB relative luminance (WCAG). */
const lum = (c: string) => {
	const [r, g, b] = chan(c).map((v) => {
		const s = v / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Push a hue to a target perceived brightness.
 *
 * Blending every family by the same ratio does NOT give keys of equal
 * presence: amber is naturally about twice as luminous as violet, so an idle
 * MARK key ended up the brightest thing on the deck while an idle MUTE key was
 * nearly black — same state, wildly different weight. Targeting luminance
 * instead means "idle" looks equally idle in every family, and state stays the
 * thing your eye reads rather than an accident of hue.
 */
const atLum = (hue: string, target: number) => {
	const anchor = lum(hue) > target ? INKY : WHITE;
	let lo = 0;
	let hi = 1;
	let out = hue;
	for (let i = 0; i < 14; i++) {
		const t = (lo + hi) / 2;
		out = mix(hue, anchor, t);
		const brighter = lum(out) > target;
		// toward INKY luminance falls as t grows; toward WHITE it rises.
		if (anchor === INKY ? brighter : !brighter) lo = t;
		else hi = t;
	}
	return out;
};

/** Every colour a face needs, resolved from state + family. */
export type Palette = {
	/** Gradient stops, top to bottom. */
	top: string;
	bottom: string;
	/** Glyph and headline text. */
	ink: string;
	/** The quieter data line. */
	data: string;
	/** Glow behind the glyph; empty string means no glow. */
	glow: string;
};

export function palette(state: KeyState, tint: Tint = "neutral"): Palette {
	// recording and alert own their colour outright — a family hue must never
	// disguise "you are rolling" or "your mic is dead".
	const hue =
		state === "recording" ? TINTS.live : state === "alert" ? TINTS.mark : TINTS[tint];

	// Luminance targets, not blend ratios — so every family reads with the same
	// weight at the same state. Tuned by eye on a contact sheet.
	switch (state) {
		case "offline": {
			// A hint of the family so the zones stay legible with OBS down,
			// but clearly asleep.
			const base = atLum(hue, 0.012);
			return {
				top: mix(base, WHITE, 0.05),
				bottom: base,
				ink: atLum(hue, 0.075),
				data: atLum(hue, 0.05),
				glow: "",
			};
		}
		case "idle": {
			// Deep and saturated rather than grey — asleep, not dead.
			const base = atLum(hue, 0.035);
			return {
				top: mix(base, WHITE, 0.07),
				bottom: mix(base, INKY, 0.22),
				ink: atLum(hue, 0.42),
				data: atLum(hue, 0.26),
				glow: "",
			};
		}
		default: {
			// active / recording / alert — full vibrancy, lit from above.
			const base = atLum(hue, 0.30);
			return {
				top: mix(base, WHITE, 0.18),
				bottom: mix(base, INKY, 0.28),
				ink: WHITE,
				data: mix(WHITE, hue, 0.3),
				glow: atLum(hue, 0.62),
			};
		}
	}
}

/**
 * Filled glyph paths, drawn in a 144x144 viewBox, visually centred on (72,66).
 * Solid rather than thin-stroked on purpose: at 72 physical px across a desk,
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
	camera:
		"M28 44 h50 a10 10 0 0 1 10 10 v24 a10 10 0 0 1 -10 10 H28 a10 10 0 0 1 -10 -10 V54 a10 10 0 0 1 10 -10 Z M94 58 L124 40 v56 L94 78 Z",
	/** A person, shoulders up — the cutout / talking-head keys. */
	person:
		"M72 50 m-17 0 a17 17 0 1 0 34 0 a17 17 0 1 0 -34 0 M40 108 a32 30 0 0 1 64 0 Z",
	/** Hourglass — the show hasn't started. */
	hourglass:
		"M44 24 h56 v10 H44 Z M44 98 h56 v10 H44 Z M50 34 h44 L72 66 Z M72 66 L94 98 H50 Z",
	/** Skip-to-end — double chevron into a bar. Reads as "wrap it up". */
	ending: "M28 36 L66 66 L28 96 Z M70 36 L108 66 L70 96 Z M112 34 h12 v64 h-12 Z",
	/** Lava lamp. */
	lamp: "M60 22 h24 v8 H60 Z M64 30 h16 l10 62 H54 Z M50 100 h44 v10 H50 Z M72 46 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M66 70 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0",
	/** Two people — a meeting. Deliberately NOT a camcorder: Meeting Mode sat
	 *  next to Camera Picker wearing the same glyph and neither could be told
	 *  from the other at a glance. */
	meeting:
		"M54 44 m-15 0 a15 15 0 1 0 30 0 a15 15 0 1 0 -30 0 M22 94 a32 28 0 0 1 64 0 Z M99 50 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 M78 92 a23 21 0 0 1 46 0 Z",
	/** Magnifier — zoom to cursor. */
	folder: "M24 40 h34 l10 10 h60 v54 H24 Z M24 58 h104",
	zoom: "M64 22 a34 34 0 1 0 0 68 a34 34 0 1 0 0 -68 Z M64 34 a22 22 0 1 1 0 44 a22 22 0 1 1 0 -44 Z M88 82 l10 -10 l28 28 l-10 10 Z",
} as const;

export type Face = {
	/** What this key is doing. Paints the whole tile. */
	state: KeyState;
	/** Which family this key belongs to. */
	tint?: Tint;
	/** A glyph from GLYPHS (or any path data in the same 144 viewBox). */
	glyph?: string;
	/** Composite art, for anything a single path can't say. */
	art?: (p: Palette) => string;
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

export function face({ state, tint, glyph, art, label, sub }: Face): string {
	const p = palette(state, tint);
	const body: string[] = [
		`<defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1">` +
			`<stop offset="0" stop-color="${p.top}"/><stop offset="1" stop-color="${p.bottom}"/>` +
			`</linearGradient>` +
			(p.glow
				? `<radialGradient id="g"><stop offset="0" stop-color="${p.glow}" stop-opacity="0.55"/>` +
					`<stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>`
				: "") +
			`</defs>`,
		`<rect width="144" height="144" fill="url(#t)"/>`,
	];

	const symbol = art ? art(p) : glyph ? `<path d="${glyph}" fill="${p.ink}"/>` : undefined;
	const line = sub ?? label;

	if (symbol) {
		const scale = line ? 0.92 : 1.25;
		const cy = line ? 54 : 72;
		if (p.glow) body.push(`<circle cx="72" cy="${cy}" r="58" fill="url(#g)"/>`);
		body.push(
			`<g transform="translate(72 ${cy}) scale(${scale}) translate(-72 -66)">${symbol}</g>`,
		);
		if (line) {
			const size = fitSize(line, sub ? 21 : 22);
			body.push(
				`<text x="72" y="126" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${sub ? 400 : 700}" fill="${sub ? p.data : p.ink}" text-anchor="middle">${esc(line)}</text>`,
			);
		}
	} else if (label) {
		// Text-only key: the label IS the content (status readout, device name).
		if (p.glow) body.push(`<circle cx="72" cy="66" r="60" fill="url(#g)"/>`);
		const size = fitSize(label, label.length <= 3 ? 52 : 34);
		body.push(
			`<text x="72" y="${sub ? 74 : 84}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="700" fill="${p.ink}" text-anchor="middle">${esc(label)}</text>`,
		);
		if (sub) {
			body.push(
				`<text x="72" y="110" font-family="Helvetica, Arial, sans-serif" font-size="${fitSize(sub, 24)}" fill="${p.data}" text-anchor="middle">${esc(sub)}</text>`,
			);
		}
	}

	return svg(body.join(""));
}

/**
 * The power symbol — a broken ring with a bar through the top. Stroked rather
 * than filled, which is why it's composite art.
 *
 * This is what the OBS key wears when OBS is down. It used to say "OFFLINE" on
 * a dimmed tile, which read as "dead, nothing here" — when in fact it is the
 * most actionable key on the deck, because pressing it launches OBS. Dim means
 * pressing does nothing; this key does something, so it stays lit.
 */
export const powerArt = (p: Palette): string =>
	`<path d="M50.8 44.8 A30 30 0 1 0 93.2 44.8" fill="none" stroke="${p.ink}" stroke-width="11" stroke-linecap="round"/>` +
	`<rect x="66" y="22" width="12" height="42" rx="6" fill="${p.ink}"/>`;

/**
 * Screen-plus-camera: a monitor knocked out in the tile colour with a person
 * sitting inside it. Composite because a same-coloured person drawn on top of
 * a solid monitor is invisible — which is exactly how the first attempt failed.
 */
export const screenCamArt = (p: Palette): string =>
	[
		`<rect x="14" y="26" width="116" height="66" rx="9" fill="${p.ink}"/>`,
		`<rect x="23" y="35" width="98" height="48" rx="4" fill="${p.bottom}"/>`,
		`<rect x="62" y="96" width="20" height="9" fill="${p.ink}"/>`,
		`<rect x="42" y="105" width="60" height="9" rx="4" fill="${p.ink}"/>`,
		`<circle cx="101" cy="55" r="9" fill="${p.ink}"/>`,
		`<path d="M85 83 a16 15 0 0 1 32 0 Z" fill="${p.ink}"/>`,
	].join("");

/**
 * The monitor-arrangement glyph: draws Ryan's ACTUAL displays as a row of
 * screens, left to right, with the one this key shares filled solid and the
 * others outlined. Sized so 1..4 displays all fit the key.
 *
 * This answers "I want the key to show what monitor I'm on" — the key is a
 * picture of the desk, not the words SCREEN L. It stays honest when a third
 * monitor arrives because the caller derives order from x-origin.
 */
export function monitorsArt(count: number, activeIndex: number, p: Palette): string {
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
			parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${p.ink}"/>`);
		} else {
			parts.push(
				`<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" rx="3" fill="none" stroke="${p.ink}" stroke-width="4" opacity="0.45"/>`,
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
 * plain circle. Recording: the whole key goes hot red and a bright core pulses
 * on a ~1.3s sine with the elapsed time under it — so a glance from across the
 * room says "yes, this is rolling". `t` is the animation clock in ms; static
 * callers omit it.
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
	const p = palette(state, "live");
	const body: string[] = [
		`<defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1">` +
			`<stop offset="0" stop-color="${p.top}"/><stop offset="1" stop-color="${p.bottom}"/>` +
			`</linearGradient></defs>`,
		`<rect width="144" height="144" fill="url(#t)"/>`,
	];

	if (recording) {
		const phase = (Math.sin((t / 1300) * Math.PI * 2) + 1) / 2; // ~1.3s breath
		const coreR = 24 + 4 * phase;
		const glowR = coreR + 10 + 12 * phase;
		body.push(
			`<circle cx="72" cy="58" r="${glowR.toFixed(1)}" fill="#ffffff" opacity="${(0.1 + 0.14 * phase).toFixed(2)}"/>`,
			`<circle cx="72" cy="58" r="${coreR.toFixed(1)}" fill="#ffffff"/>`,
			`<circle cx="72" cy="58" r="${(coreR - 7).toFixed(1)}" fill="${TINTS.live}" opacity="${(0.8 + 0.2 * phase).toFixed(2)}"/>`,
		);
	} else {
		body.push(`<circle cx="72" cy="${note ? 58 : 66}" r="27" fill="${p.ink}"/>`);
	}

	const line = recording ? fmtDuration(elapsedMs) : note;
	if (line) {
		body.push(
			`<text x="72" y="126" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="${p.data}" text-anchor="middle">${esc(line)}</text>`,
		);
	}
	return svg(body.join(""));
}
