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
	status: ["status", "Status"],
	record: ["record", "Record"],
	mark: ["mark", "Mark"],
	mute: ["mute-mic", "Mute Mic"],
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
	["status", null, null, null, "soon", "brb", "ending", "record"], // row 0 — far
	[null, null, null, null, null, null, null, null], //              row 1 — gutter
	["screenLeft", "screenRight", "screenCam", null, "cam", "cutout", "float", "lava"], // row 2
	["mark", "mute", null, null, "camera", "meeting", null, null], //   row 3 — near
];

/**
 * The Stream Deck + (4x2) is also paired and was carrying orphaned keys of its
 * own. Eight keys only, so it gets the irreducible set: what's on screen, and
 * the two you press mid-sentence.
 */
export const SDPLUS = [
	["status", "screenLeft", "screenRight", "record"],
	["mark", "mute", "cam", "cutout"],
];

export const DEVICES = {
	"20GAT9902": { name: "Stream Deck XL", cols: 8, rows: 4, layout: XL },
	"20GBD9901": { name: "Stream Deck +", cols: 4, rows: 2, layout: SDPLUS },
};

/** Full action UUID for a short name. */
export const uuidOf = (short) => `${PLUGIN}.${ACTIONS[short][0]}`;
export const nameOf = (short) => ACTIONS[short][1];

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
