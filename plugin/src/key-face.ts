/**
 * One SVG generator for every key face, so the deck reads as one system.
 * 144x144 (the @2x key size); returned as an SVG data URI for setImage.
 *
 * Icon-first grammar (2026-07-21): a face can carry a GLYPH — a filled
 * pictorial symbol drawn large and centered — instead of a text label.
 * The picture says what the key does; text is for state detail (sub) and
 * the tiny identifying tag. Text-only faces remain for state words
 * (LIVE, countdowns) where the word IS the picture.
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
} as const;

export type Face = {
	/** Big text, the state word. Auto-shrinks to fit. Omit when glyph is set. */
	label?: string;
	/** Small line at the bottom (timer, hint, device name). */
	sub?: string;
	/** Tiny line at the top (action name so keys stay identifiable). */
	tag?: string;
	color: string;
	/** Filled dot before the label (recording/live indicator). Text faces only. */
	dot?: boolean;
	/** Pictorial symbol from GLYPHS (or any 144-viewBox path data). */
	glyph?: string;
};

const esc = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function face({ label = "", sub, tag, color, dot, glyph }: Face): string {
	const tagText = tag
		? `<text x="72" y="30" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#5c6785" text-anchor="middle">${esc(tag)}</text>`
		: "";
	const subText = sub
		? `<text x="72" y="${glyph ? 132 : 116}" font-family="Helvetica, Arial, sans-serif" font-size="${glyph ? 16 : 18}" fill="#8fa0c5" text-anchor="middle">${esc(sub)}</text>`
		: "";

	let center: string;
	if (glyph) {
		center = `<path d="${glyph}" fill="${color}"/>`;
	} else {
		const labelSize = label.length <= 5 ? 34 : label.length <= 8 ? 26 : 20;
		const labelY = sub ? 82 : 88;
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
		tagText +
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
