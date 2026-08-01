/**
 * One SVG generator for every key face, so the deck reads as one system.
 * 144x144 (the @2x key size); returned as an SVG data URI for setImage.
 *
 * Face grammar (Ryan, 2026-07-21 — set by the official Elgato OBS keys):
 * the picture IS the key. One glyph, drawn large and centered, colored by
 * state; an unavailable action is the same glyph dimmed. Text earns its
 * place only as live data — elapsed time, a countdown, a device name,
 * dropped frames — never instructions. Buttons are for pressing.
 * Text faces remain for keys whose content is a word or number
 * (status readout, scene names, countdown digits).
 */

export const COLORS = {
	bg: "#101527",
	offline: "#5c6785",
	ready: "#e2e8f0",
	live: "#e94560",
	rec: "#e9a145",
	meeting: "#45b3e9",
} as const;

/** Filled SVG paths, drawn in a 144x144 viewBox, visually centered ~(72,66). */
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
} as const;

export type Face = {
	/** Big text, for keys whose content IS a word or number. Auto-shrinks. */
	label?: string;
	/** Bottom line — live data only (timer, countdown, device, %). */
	sub?: string;
	color: string;
	/** Filled dot before the label (recording/live indicator). Text faces only. */
	dot?: boolean;
	/** Pictorial symbol from GLYPHS (or any 144-viewBox path data). */
	glyph?: string;
};

const esc = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function face({ label = "", sub, color, dot, glyph }: Face): string {
	const subText = sub
		? `<text x="72" y="${glyph ? 130 : 118}" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#8fa0c5" text-anchor="middle">${esc(sub)}</text>`
		: "";

	let center: string;
	if (glyph) {
		// Glyph paths are authored around (72,66); fill the key when it's
		// the whole face, sit up a little when a data line shares it.
		const s = sub ? 1.0 : 1.25;
		const cy = sub ? 60 : 72;
		center = `<g transform="translate(72 ${cy}) scale(${s}) translate(-72 -66)"><path d="${glyph}" fill="${color}"/></g>`;
	} else {
		const labelSize = label.length <= 2 ? 54 : label.length <= 5 ? 34 : label.length <= 8 ? 26 : 20;
		const labelY = sub ? 78 : 82;
		const dotMark = dot
			? `<circle cx="${72 - measure(label, labelSize) / 2 - 14}" cy="${labelY - labelSize * 0.32}" r="7" fill="${color}"/>`
			: "";
		center =
			dotMark +
			`<text x="${dot ? 72 + 9 : 72}" y="${labelY}" font-family="Helvetica, Arial, sans-serif" font-size="${labelSize}" font-weight="700" fill="${color}" text-anchor="middle">${esc(label)}</text>`;
	}

	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">` +
		`<rect width="144" height="144" rx="18" fill="${COLORS.bg}"/>` +
		center +
		subText +
		`</svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Rough width estimate for centering the dot next to the label.
const measure = (s: string, size: number) => s.length * size * 0.62;

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
 * The record key, its own face because it's the one that breathes. Not
 * recording: a plain circle (white ready / dim offline). Recording: a live red
 * blob that pulses — a soft glow ring and the core both swell on a ~1.3s sine,
 * with the elapsed time under it. `t` is the animation clock (ms since the
 * pulse started); pass it every frame from the animator. Static callers omit it.
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

	let center: string;
	if (recording) {
		const phase = (Math.sin((t / 1300) * Math.PI * 2) + 1) / 2; // 0..1, ~1.3s breath
		const coreR = 23 + 4 * phase;
		const coreO = 0.8 + 0.2 * phase;
		const glowR = coreR + 9 + 11 * phase;
		const glowO = 0.1 + 0.22 * phase;
		center =
			`<circle cx="72" cy="60" r="${glowR.toFixed(1)}" fill="${COLORS.live}" opacity="${glowO.toFixed(2)}"/>` +
			`<circle cx="72" cy="60" r="${coreR.toFixed(1)}" fill="${COLORS.live}" opacity="${coreO.toFixed(2)}"/>`;
	} else {
		center = `<circle cx="72" cy="66" r="26" fill="${connected ? COLORS.ready : COLORS.offline}"/>`;
	}

	const line = recording ? fmtDuration(elapsedMs) : note;
	const sub = line
		? `<text x="72" y="${recording ? 122 : 118}" font-family="Helvetica, Arial, sans-serif" font-size="${recording ? 22 : 20}" fill="${recording ? "#f3aab3" : "#8fa0c5"}" text-anchor="middle">${esc(line)}</text>`
		: "";

	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">` +
		`<rect width="144" height="144" rx="18" fill="${COLORS.bg}"/>` +
		center +
		sub +
		`</svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
