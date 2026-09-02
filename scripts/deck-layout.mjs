/**
 * THE XL LAYOUT, as data. This file is the single source of truth for which
 * action sits on which key — not the Stream Deck app's database.
 *
 * Why it lives here: on 2026-08-01 the XL was found with five keys pointing at
 * actions that had been deleted from the plugin weeks earlier. Nothing in the
 * loop compared the deck against the code, so the deck rotted silently while
 * the logs said everything was fine. Layout-as-data plus `check-deck.mjs` is
 * the tripwire. Edit here, run `build-profile.mjs`, never drag keys in the app.
 *
 * DESIGN — reach, not category (the old layout had this exactly backwards,
 * with every live key on the far rows and the two rows nearest the hand empty):
 *
 *   row 3  nearest the hand   → what you press mid-sentence: MARK, MUTE
 *   row 2  still easy         → what's on screen: the screens, the camera looks
 *   row 1  deliberately empty → a full gutter row; a tactile landmark you can
 *                               feel for without looking
 *   row 0  furthest away      → read often, pressed rarely, and safe from a
 *                               stray palm: STATUS, the show bracket, RECORD
 *
 * Empty keys are not waste. The gutter at column 3 separates "which screen"
 * from "which camera look" so the hand finds a block by touch.
 */

export const PLUGIN = "com.blessdog.obs-control-room";

/** Short name → the action's UUID suffix and the label the app shows. */
export const ACTIONS = {
	record: ["record", "Record"],
	mark: ["mark", "Mark"],
	mute: ["mute-mic", "Mute Mic"],
	pause: ["pause", "Pause Recording"],
	shot: ["shot", "Screenshot"],
	reveal: ["reveal", "Reveal Recording"],
	camera: ["camera-picker", "Camera Picker"],
	meeting: ["meeting-mode", "Meeting Mode"],
	soon: ["scene-starting-soon", "Scene: Starting Soon"],
	ending: ["scene-ending", "Scene: Ending"],
	brb: ["scene-brb", "Scene: BRB"],
	float: ["scene-me-float", "Scene: Me + Float"],
	screenLeft: ["scene-screen-left", "Scene: Screen L"],
	screenRight: ["scene-screen-right", "Scene: Screen R"],
	screenCam: ["scene-screen-cam", "Scene: Screen + Cam"],
	cam: ["scene-cam", "Scene: Cam"],
	cutout: ["scene-cam-cutout", "Scene: Cam Cutout"],
	lava: ["scene-lava-lounge", "Scene: Lava Lounge"],
	// rectum page — the clipper (~/projects/rectum). These keys shell out to
	// its CLI; the plugin owns the face, rectum owns capture and the library.
	rectumLeft: ["rectum-left", "rectum: Record LEFT monitor"],
	rectumRight: ["rectum-right", "rectum: Record RIGHT monitor"],
	rectumCrop: ["rectum-crop", "rectum: Crop last clip"],
	rectumGrab: ["rectum-grab", "rectum: Grab clip from URL"],
};

/**
 * The Stream Deck XL grid, written the way it sits on the desk. `null` is a
 * deliberately dark key. Row 3 is the row closest to you.
 *
 * NOTE: the app auto-places its own page-navigation key on a free key when a
 * profile has more than one page, and that key cannot be deleted or moved.
 * Leaving the bottom-right corner free lets it land somewhere harmless.
 */
export const XL = [
	// c0          c1          c2           c3     c4         c5          c6       c7
	[null, null, null, null, "soon", "brb", "ending", "record"], //       row 0 — far
	[null, null, "zoomOut", null, null, null, "reveal", "pause"], //      row 1 — gutter, three exceptions
	["screenLeft", "screenRight", "screenCam", null, "cam", "cutout", "float", "lava"], // row 2
	["mark", "mute", "zoomIn", null, "camera", "meeting", "shot", "pageNext"], // row 3 — near; 7,3 is the app's own page key
];
// ZOOM OUT sits directly above ZOOM IN and PAUSE directly below RECORD, so each
// pair is found by touch; REVEAL sits beside PAUSE (the file you just made).
// The bottom-right key is the Stream Deck app's page-navigation key: it must
// exist for page 2 (rectum) to be reachable, and 2026-09-02 proved that placing
// anything else there deletes it — so it is placed from here, like every key.
// STATUS is gone (knowledge/recording-friction-is-the-product).

/**
 * The Stream Deck + (4x2) is also paired and was carrying orphaned keys of its
 * own. Eight keys only, so it gets the irreducible set: what's on screen, and
 * the two you press mid-sentence.
 */
export const SDPLUS = [
	["screenCam", "screenLeft", "screenRight", "record"],
	["mark", "mute", "cam", "reveal"],
];

/**
 * PAGE 2 — rectum, the clipper. Named for `rect`, the unit it operates on.
 *
 * The app's `previous` nav key already sits at 0,3 and cannot be moved, so the
 * bottom-left corner is spoken for. Everything else follows the same reach rule
 * as page 1: what you press constantly goes on row 3, nearest the hand, and the
 * column-3 gutter stays dark so the hand finds a block by touch.
 *
 * Only the keys that have actions behind them. An invented key that does
 * nothing is worse than an empty one — the deck rotted for a week in July
 * precisely because keys pointed at things that were not there.
 *
 * GRAB sits apart from LEFT/RIGHT/CROP on purpose. Those three are one flow
 * (film a monitor, then find the video inside it); GRAB is the other way in
 * entirely — paste a URL and the video arrives whole. It is also the one that
 * needs no macOS permission, which is why it is now the DEFAULT path and the
 * capture keys are the fallback for what cannot be downloaded.
 */
export const XL_RECTUM = [
	// c0        c1              c2               c3     c4            c5    c6    c7
	[null, null, null, null, null, null, null, null], //          row 0 — far
	[null, null, null, null, null, null, null, null], //          row 1 — gutter
	[null, null, null, null, null, null, null, null], //          row 2
	[null, "rectumLeft", "rectumRight", null, "rectumCrop", null, "rectumGrab", null], // row 3 — near (0,3 = nav)
];

/**
 * `pages` is written in profile page order. A device may own more pages than we
 * describe; the extras are left completely alone rather than blanked, because
 * other tools put keys there and they are none of our business.
 */
export const DEVICES = {
	"20GAT9902": {
		name: "Stream Deck XL", cols: 8, rows: 4,
		layout: XL, pages: [XL, XL_RECTUM],
	},
	"20GBD9901": {
		name: "Stream Deck +", cols: 4, rows: 2,
		// Page 2 is described as EMPTY so that our keys are cleared from it —
		// it carried a stale copy of the layout (Status key orphaned, 2026-09-02).
		// Foreign keys on it are still kept.
		layout: SDPLUS, pages: [SDPLUS, [[null, null, null, null], [null, null, null, null]]],
	},
};

/**
 * Native Stream Deck actions we place. The Hotkey settings shape was harvested
 * from a hand-placed key on 2026-09-02. Modifier bitmask: Shift 1 · Ctrl 2 ·
 * Option 4 · Cmd 8. NativeCode is the macOS virtual keycode (= is 24, - is 27).
 *
 * ZOOM drives macOS Accessibility Zoom (knowledge/zoom-is-native-macos-zoom):
 * Ryan zooms the screen he is looking at and OBS records the composite. The
 * OBS-side zoom is in archive/zoom-in-obs with the measured reason.
 */
const NO_KEY = { KeyCmd: false, KeyCtrl: false, KeyOption: false, KeyShift: false, KeyModifiers: 0, NativeCode: -1, QTKeyCode: 33554431, VKeyCode: -1 };
const hotkey = (nativeCode, ascii, { cmd = false, ctrl = false, option = false, shift = false } = {}) => ({
	Coalesce: true,
	Hotkeys: [
		{
			KeyCmd: cmd, KeyCtrl: ctrl, KeyOption: option, KeyShift: shift,
			KeyModifiers: (shift ? 1 : 0) + (ctrl ? 2 : 0) + (option ? 4 : 0) + (cmd ? 8 : 0),
			NativeCode: nativeCode, QTKeyCode: ascii, VKeyCode: nativeCode,
		},
		NO_KEY, NO_KEY, NO_KEY,
	],
});
export const NATIVE = {
	pageNext: { uuid: "com.elgato.streamdeck.page.next", name: "Next Page", plugin: { Name: "Pages", UUID: "com.elgato.streamdeck.page", Version: "1.0" }, settings: {}, linkedTitle: true },
	zoomIn: { uuid: "com.elgato.streamdeck.system.hotkey", name: "Hotkey", title: "ZOOM\n+", settings: hotkey(24, 61, { option: true, cmd: true }) },
	zoomOut: { uuid: "com.elgato.streamdeck.system.hotkey", name: "Hotkey", title: "ZOOM\n−", settings: hotkey(27, 45, { option: true, cmd: true }) },
};
export const isNative = (short) => short in NATIVE;

/**
 * How a human proves each key works: one sentence, an action and what to look
 * at. check-deck.mjs fails on a key without one — a key nobody can test is a
 * key nobody knows is dead (five of them, 2026-08-01).
 */
export const VERIFY = {
	record: "Press; press again; ~/Movies gains a playable MP4.",
	pageNext: "Press; the deck shows page 2 (rectum). Its own Previous key comes back.",
	pause: "Press mid-recording, press again; the finished file plays through both halves.",
	mark: "Press twice while recording; ffprobe shows two chapters.",
	mute: "Press; OBS mixer shows Mic muted and the key turns red.",
	camera: "Press; the Cam scene switches iPhone ↔ FaceTime.",
	meeting: "Press; OBS Virtual Camera appears in a Zoom/Meet camera list.",
	shot: "Press; Finder reveals a PNG of what was on program.",
	reveal: "Press after a recording; Finder opens with that MP4 selected.",
	soon: "Press; program shows Starting Soon and the key lights.",
	ending: "Press; program shows Ending.",
	brb: "Press; program shows BRB.",
	float: "Press; full-bleed camera with the share as a card lower-right.",
	screenLeft: "Press; program shows the LEFT monitor with real windows, not wallpaper.",
	screenRight: "Press; program shows the RIGHT monitor with real windows.",
	screenCam: "Press; screen with the camera bubble bottom-left.",
	cam: "Press; full camera.",
	cutout: "Press; Ryan on a transparent background, no room (obs/check-cutout.mjs).",
	lava: "Press; lava lamp behind the cutout.",
	rectumLeft: "Press, press again; the rectum library gains a clip of the left monitor.",
	rectumRight: "Press, press again; the rectum library gains a clip of the right monitor.",
	rectumCrop: "Press after a rectum recording; the crop proposal opens.",
	rectumGrab: "Press with a video URL in the front tab; the file lands in the clip library.",
	zoomIn: "Press with the mouse on the left monitor; the screen AND a Screen L snapshot zoom in.",
	zoomOut: "Press; the zoom steps back out.",
};

/** Full action UUID for a short name — ours or native. */
export const uuidOf = (short) => (isNative(short) ? NATIVE[short].uuid : `${PLUGIN}.${ACTIONS[short][0]}`);
export const nameOf = (short) => (isNative(short) ? NATIVE[short].name : ACTIONS[short][1]);

/** Every (coord, short-name) pair the layout actually places. */
export function placements(layout = XL) {
	const out = [];
	layout.forEach((row, r) =>
		row.forEach((short, c) => {
			if (short) out.push({ coord: `${c},${r}`, short });
		}),
	);
	return out;
}
