// Archived 2026-09-08 — see README.md beside this file. Was in plugin/src/actions/scene-keys.ts.
@action({ UUID: "com.blessdog.obs-control-room.scene-cam-cutout" })
export class SceneCamCutout extends SceneKey {
	protected override readonly tint = "camera" as const;
	protected readonly scene = SCENES.camCutout;
	protected readonly label = "CUTOUT";
	protected override readonly glyph = GLYPHS.person;
}
