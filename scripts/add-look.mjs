#!/usr/bin/env node
/**
 * Add a "look" to the Control Room collection WITHOUT wiping it.
 *
 * `setup-scenes.mjs` is the from-scratch builder and it wipes the collection to
 * run. That's the wrong tool for "I want one more scene" — losing a working rig
 * to add a look is how you end up not adding looks. This is additive and
 * idempotent: it skips a scene that already exists unless you pass --replace.
 *
 *   node scripts/add-look.mjs brb
 *   node scripts/add-look.mjs float
 *   node scripts/add-look.mjs character "Cubicle" ~/Pictures/cubicle.jpg
 *
 * "character" is the template Ryan asked for: hand it a background image and it
 * builds a scene with him cut out over it. Every character scene is the same
 * shape, so adding the tenth costs exactly what the first did.
 */
import { connect } from './lib/obs.mjs';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , kind, ...rest] = process.argv;
const REPLACE = rest.includes('--replace');
const args = rest.filter((a) => a !== '--replace');

if (!kind) {
  console.error('usage: add-look.mjs <brb|float|character> [name] [image]');
  process.exit(1);
}

const obs = await connect({ launch: true });

try {
  const { baseWidth: W, baseHeight: H } = await obs.call('GetVideoSettings');

  if (kind === 'brb') await brb(W, H);
  else if (kind === 'float') await meFloat(W, H);
  else if (kind === 'character') {
    const [name, image] = args;
    if (!name || !image) {
      console.error('usage: add-look.mjs character "<name>" <image-path>');
      process.exit(1);
    }
    await character(name, resolve(image.replace(/^~/, process.env.HOME)), W, H);
  } else {
    console.error(`unknown look: ${kind}`);
    process.exit(1);
  }
} finally {
  await obs.disconnect();
}

// ---------------------------------------------------------------------------

/** Create a scene, or bail out politely if it's already there. */
async function freshScene(sceneName) {
  const { scenes } = await obs.call('GetSceneList');
  if (scenes.some((s) => s.sceneName === sceneName)) {
    if (!REPLACE) {
      console.log(`"${sceneName}" already exists — pass --replace to rebuild it.`);
      return false;
    }
    await obs.call('RemoveScene', { sceneName });
  }
  await obs.call('CreateScene', { sceneName });
  return true;
}

/** Reuse the shared inputs rather than making per-scene copies (SSOT). */
async function addShared(sceneName, sourceName) {
  const { sceneItemId } = await obs.call('CreateSceneItem', { sceneName, sourceName });
  return sceneItemId;
}

async function fit(sceneName, sceneItemId, x, y, w, h) {
  await obs.call('SetSceneItemTransform', {
    sceneName,
    sceneItemId,
    sceneItemTransform: {
      positionX: x,
      positionY: y,
      alignment: 5, // top-left anchor
      boundsType: 'OBS_BOUNDS_SCALE_INNER',
      boundsAlignment: 0,
      boundsWidth: w,
      boundsHeight: h,
    },
  });
}

/** The one standard scene the rig was missing. */
async function brb(W, H) {
  const sceneName = 'BRB';
  if (!(await freshScene(sceneName))) return;
  await obs.call('CreateInput', {
    sceneName,
    inputName: 'BRB BG',
    inputKind: 'color_source_v3',
    inputSettings: { color: 0xff1a2e2e, width: W, height: H },
  });
  await obs.call('CreateInput', {
    sceneName,
    inputName: 'BRB Text',
    inputKind: 'text_ft2_source_v2',
    inputSettings: {
      text: 'Back in a moment',
      font: { face: 'Helvetica Neue', size: 96, flags: 0 },
      color1: 0xffffffff,
      color2: 0xffffffff,
    },
  });
  const { sceneItemId } = await obs.call('GetSceneItemId', { sceneName, sourceName: 'BRB Text' });
  await obs.call('SetSceneItemTransform', {
    sceneName,
    sceneItemId,
    sceneItemTransform: { positionX: W / 2, positionY: H / 2, alignment: 0 },
  });
  await addShared(sceneName, 'Mic');
  console.log(`Scene "${sceneName}" built.`);
}

/**
 * "Me + Float" — Ryan's ask, verbatim: "the camera cuts to me and pushes me to
 * the side and isn't just a little cutout in the corner, but it's still full
 * screen me, and then has a floating screen share in the middle punch out."
 *
 * So: camera fills the frame, and the screen share floats on top, right of
 * centre, leaving the left third of the frame for him. A slightly larger plate
 * sits behind it so the float reads as a card rather than a hole punched in the
 * picture. (With the Move plugin installed, cutting between Cam and this scene
 * animates the shift on its own — the camera item is the same shared source in
 * both, which is exactly what Move matches on.)
 */
async function meFloat(W, H) {
  const sceneName = 'Me + Float';
  if (!(await freshScene(sceneName))) return;

  // THE CENTER STAGE PROBLEM (Ryan, 2026-08-01: "right now it's right in the
  // middle blocking me completely"). Continuity Camera actively keeps him
  // CENTRED in the camera frame, so a float placed centre-right doesn't sit
  // beside him — the camera tracks him straight back underneath it. Moving the
  // float can never fix that, because the camera is chasing.
  //
  // The fix is to stop mapping the camera frame 1:1 onto the canvas. Center
  // Stage centres him in the FRAME; nothing stops us putting that frame off to
  // the left of the CANVAS. He keeps the follow-shot and clears the share.
  // No camera swap, and no upscaling — upscaling would only add grain to an
  // already-soft feed (Center Stage runs off the ultra-wide lens).
  const panelX = Math.round(W * 0.427);   // 820 on a 1920 canvas
  const camCentre = Math.round(W * 0.214); // where his face lands: ~410

  // Native scale, shifted left so his centre lands on camCentre. Everything
  // right of panelX is covered by the panel, so the shift can't expose a gap.
  const camId = await addShared(sceneName, 'Camera');
  await obs.call('SetSceneItemTransform', {
    sceneName,
    sceneItemId: camId,
    sceneItemTransform: {
      positionX: camCentre - W / 2,
      positionY: 0,
      alignment: 5,
      boundsType: 'OBS_BOUNDS_SCALE_INNER',
      boundsAlignment: 0,
      boundsWidth: W,
      boundsHeight: H,
    },
  });

  // A full-height panel, not a floating rectangle: a deliberate side panel
  // reads as design, where a rectangle with a sliver of gap beside it reads as
  // a mistake.
  const panelW = W - panelX;
  await obs.call('CreateInput', {
    sceneName,
    inputName: 'Float Plate',
    inputKind: 'color_source_v3',
    inputSettings: { color: 0xff0d0d11, width: panelW, height: H },
  });
  const { sceneItemId: plateId } = await obs.call('GetSceneItemId', {
    sceneName,
    sourceName: 'Float Plate',
  });
  await obs.call('SetSceneItemTransform', {
    sceneName,
    sceneItemId: plateId,
    sceneItemTransform: { positionX: panelX, positionY: 0, alignment: 5 },
  });

  // The share, inset in the panel with an even margin.
  const pad = 20;
  const fw = panelW - pad * 2;
  const fh = Math.round((fw * 9) / 16);
  const fx = panelX + pad;
  const fy = Math.round((H - fh) / 2);
  const screenId = await addShared(sceneName, 'Display');
  await fit(sceneName, screenId, fx, fy, fw, fh);

  await addShared(sceneName, 'Mic');
  console.log(`Scene "${sceneName}" — he sits at x~${camCentre}, panel from ${panelX}, share ${fw}x${fh}.`);
}

/**
 * A character scene: Ryan cut out (background removed) over a supplied image.
 * Same shape every time, so the tenth costs what the first did.
 */
async function character(name, image, W, H) {
  if (!existsSync(image) || !statSync(image).isFile()) {
    console.error(`No such image: ${image}`);
    process.exit(1);
  }
  const sceneName = name;
  if (!(await freshScene(sceneName))) return;

  await obs.call('CreateInput', {
    sceneName,
    inputName: `${name} BG`,
    inputKind: 'image_source',
    inputSettings: { file: image },
  });
  const { sceneItemId: bgId } = await obs.call('GetSceneItemId', {
    sceneName,
    sourceName: `${name} BG`,
  });
  // Cover the canvas: outer fit crops rather than letterboxes, which is what a
  // backdrop wants.
  await obs.call('SetSceneItemTransform', {
    sceneName,
    sceneItemId: bgId,
    sceneItemTransform: {
      positionX: 0,
      positionY: 0,
      alignment: 5,
      boundsType: 'OBS_BOUNDS_SCALE_OUTER',
      boundsAlignment: 0,
      boundsWidth: W,
      boundsHeight: H,
    },
  });

  // "Cam Cutout" is the existing background-removed camera scene — reusing it
  // means one place to tune the key, and every character inherits the fix.
  const cutId = await addShared(sceneName, 'Cam Cutout');
  await fit(sceneName, cutId, 0, 0, W, H);
  await addShared(sceneName, 'Mic');

  console.log(`Scene "${sceneName}" built over ${image}.`);
  console.log(`Give it a key: add a slot in scripts/deck-layout.mjs, then run build-profile.mjs`);
}
