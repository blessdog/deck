// Lifted from GLYPHS in plugin/src/key-face.ts on 2026-09-08. Faces for the
// TAKEAWAY and CHAPTER keys; nothing live draws them.
export const CUE_GLYPHS = {
	/** A lower banner: the frame with a plate across its bottom third. */
	takeaway:
		"M18 30 h108 a8 8 0 0 1 8 8 v64 a8 8 0 0 1 -8 8 H18 a8 8 0 0 1 -8 -8 V38 a8 8 0 0 1 8 -8 Z M26 38 h92 v34 H26 Z",
	/** A chapter: a page with two lines and a ribbon cut into its foot. */
	chapter:
		"M30 24 h84 v92 l-42 -22 l-42 22 Z M46 44 h52 v8 H46 Z M46 60 h52 v8 H46 Z",
	/** Lava lamp. */
	lamp: "M60 22 h24 v8 H60 Z M64 30 h16 l10 62 H54 Z M50 100 h44 v10 H50 Z M72 46 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M66 70 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0",
} as const;
