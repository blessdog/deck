# scene-cam-cutout key — archived 2026-09-08

**What it was for:** the CUTOUT key on row 2 cut to the `Cam Cutout` scene, a
separate scene holding its own `Camera FX` input with the remover always on.

**What beat it:** CUTOUT became a *modifier*, not a scene. Ryan, 2026-09-08:
"I already have a cam scene. What I want is to be able to hit cutout in
whatever scene I'm in, and it cuts out the background. Just has me
free-floating in it." The remover now also sits on the shared Camera, disabled,
and the key toggles it (`plugin/src/actions/cutout.ts`), so Cam, Screen + Cam,
Me + Float and React all cut out in place.

**Measured reason:** none needed — the scene key still worked; it answered the
wrong question. The `Cam Cutout` scene itself is NOT archived: Lava Lounge
nests it as its always-on cutout substrate.

The class below is what registered as `com.blessdog.obs-control-room.scene-cam-cutout`.
