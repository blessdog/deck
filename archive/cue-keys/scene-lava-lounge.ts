// Lifted from plugin/src/actions/scene-keys.ts on 2026-09-08. Registered as
// com.blessdog.obs-control-room.scene-lava-lounge. Needs SceneKey and GLYPHS
// from the live tree to compile; see README.md for how to put it back.
@action({ UUID: "com.blessdog.obs-control-room.scene-lava-lounge" })
export class SceneLavaLounge extends SceneKey {
	protected override readonly tint = "warm" as const;
	protected readonly scene = "Lava Lounge";
	protected readonly label = "LAVA";
	protected override readonly glyph = GLYPHS.lamp;
}

