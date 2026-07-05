/**
 * One SVG generator for every key face, so the deck reads as one system.
 * 144x144 (the @2x key size); returned as an SVG data URI for setImage.
 */

export const COLORS = {
	bg: "#101527",
	offline: "#5c6785",
	ready: "#e2e8f0",
	live: "#e94560",
	rec: "#e9a145",
	meeting: "#45b3e9",
} as const;

export type Face = {
	/** Big text, the state word. Auto-shrinks to fit. */
	label: string;
	/** Small line under the label (timer, hint, device name). */
	sub?: string;
	/** Tiny line at the top (action name so keys stay identifiable). */
	tag?: string;
	color: string;
	/** Filled dot before the label (recording/live indicator). */
	dot?: boolean;
};

const esc = (s: string) =>
	s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function face({ label, sub, tag, color, dot }: Face): string {
	const labelSize = label.length <= 5 ? 34 : label.length <= 8 ? 26 : 20;
	const labelY = sub ? 82 : 88;
	const dotMark = dot
		? `<circle cx="${72 - measure(label, labelSize) / 2 - 14}" cy="${labelY - labelSize * 0.32}" r="7" fill="${color}"/>`
		: "";
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">` +
		`<rect width="144" height="144" rx="18" fill="${COLORS.bg}"/>` +
		(tag
			? `<text x="72" y="34" font-family="Helvetica, Arial, sans-serif" font-size="15" fill="#5c6785" text-anchor="middle">${esc(tag)}</text>`
			: "") +
		dotMark +
		`<text x="${dot ? 72 + 9 : 72}" y="${labelY}" font-family="Helvetica, Arial, sans-serif" font-size="${labelSize}" font-weight="700" fill="${color}" text-anchor="middle">${esc(label)}</text>` +
		(sub
			? `<text x="72" y="116" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#8fa0c5" text-anchor="middle">${esc(sub)}</text>`
			: "") +
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
