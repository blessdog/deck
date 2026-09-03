#!/usr/bin/env node
/**
 * Add a "look" to the Control Room collection WITHOUT wiping it.
 *
 * `setup-scenes.mjs` is the from-scratch builder and it wipes the collection to
 * run. That's the wrong tool for "I want one more scene" — losing a working rig
 * to add a look is how you end up not adding looks. This is additive and
 * idempotent: it skips a scene that already exists unless you pass --replace.
 *
 *   node obs/add-look.mjs brb
 *   node obs/add-look.mjs float
 *   node obs/add-look.mjs character "Cubicle" ~/Pictures/cubicle.jpg
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
  console.error('usage: add-look.mjs <brb|float|character|screens|cutout|iso> [name] [image]');
  process.exit(1);
}

const obs = await connect({ launch: true });

try {
  const { baseWidth: W, baseHeight: H } = await obs.call('GetVideoSettings');

  if (kind === 'screens') await fitScreens(W, H);
  else if (kind === 'brb') await brb(W, H);
  else if (kind === 'float') await meFloat(W, H);
  else if (kind === 'cutout') await cutout();
  else if (kind === 'iso') await cameraIso();
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

/**
 * Make every display capture FILL the canvas instead of sitting in black bars.
 *
 * Ryan, 2026-08-01: "what's up with all the extra space around the frame".
 * Measured: Screen R had 125px of pure black down each side. Not a bug —
 * geometry. The built-in MacBook panel is 3456x2234 (aspect 1.547) and the
 * canvas is 16:9 (1.778), so fitting the whole screen inside it leaves bars.
 * The external monitor is natively 16:9, which is why only one screen looked
 * wrong.
 *
 * Rather than letterbox, crop the source to the canvas aspect first. The trim
 * is biased to the TOP because that's where the menu bar lives — the part of a
 * screen share nobody needs — so we spend the loss on chrome rather than
 * content. Nothing is scaled up, so no sharpness is lost.
 */
async function fitScreens(W, H) {
  const canvasAspect = W / H;
  const { scenes } = await obs.call('GetSceneList');
  for (const { sceneName } of scenes) {
    const { sceneItems } = await obs.call('GetSceneItemList', { sceneName });
    for (const it of sceneItems) {
      if (it.inputKind !== 'screen_capture') continue;
      const { sceneItemTransform: t } = await obs.call('GetSceneItemTransform', {
        sceneName,
        sceneItemId: it.sceneItemId,
      });
      const sw = t.sourceWidth, sh = t.sourceHeight;
      if (!sw || !sh) continue;

      let cropTop = 0, cropBottom = 0, cropLeft = 0, cropRight = 0;
      if (sw / sh < canvasAspect) {
        // Too tall: trim height. 70% off the top (menu bar), 30% off the bottom.
        const excess = Math.round(sh - sw / canvasAspect);
        cropTop = Math.round(excess * 0.7);
        cropBottom = excess - cropTop;
      } else if (sw / sh > canvasAspect) {
        const excess = Math.round(sw - sh * canvasAspect);
        cropLeft = Math.round(excess / 2);
        cropRight = excess - cropLeft;
      }

      // Only re-fit items that are ALREADY the full frame. A Display placed as
      // a card (Me + Float) keeps its bounds and only gains the crop —
      // 2026-09-02: this loop flattened the float card to full frame and the
      // camera underneath vanished; the scene rendered identical to Screen L.
      const isFullFrame = Math.round(t.boundsWidth) >= W && Math.round(t.boundsHeight) >= H;
      const transform = isFullFrame
        ? { cropTop, cropBottom, cropLeft, cropRight,
            positionX: 0, positionY: 0, alignment: 5,
            boundsType: 'OBS_BOUNDS_SCALE_INNER', boundsAlignment: 0,
            boundsWidth: W, boundsHeight: H }
        : { cropTop, cropBottom, cropLeft, cropRight };
      await obs.call('SetSceneItemTransform', {
        sceneName,
        sceneItemId: it.sceneItemId,
        sceneItemTransform: transform,
      });
      const kept = ((sh - cropTop - cropBottom) / sh * 100).toFixed(1);
      console.log(`${sceneName} / ${it.sourceName}: ${sw}x${sh} -> crop T${cropTop} B${cropBottom} L${cropLeft} R${cropRight} (keeps ${kept}% of height)`);
    }
  }
}

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

  // Ryan's ask, verbatim: "it's still full screen me, but then has a floating
  // screen share in the middle punch out." FULL BLEED is the point — a scene
  // that solves the overlap with a big black panel has thrown away the reason
  // the scene exists ("the whole point was so that we didn't have all this
  // black space, keeping it interesting").
  //
  // The collision: Continuity Camera's Center Stage keeps him CENTRED in the
  // camera frame, so the share lands on his face and moving the share can
  // never help — the camera tracks him back under it.
  //
  // The constraint: he's centred in the source, so putting him off-centre AND
  // filling the canvas needs some upscale. Minimum is s = 2 * (1 - C/W). Push
  // him only to 40% and that's 1.20 — visually nothing. Pushing further gets
  // expensive fast (25% would need 1.5x), and upscaling compounds the grain,
  // because Center Stage runs off the iPhone's ultra-wide lens.
  const camCentre = Math.round(W * 0.40);
  const scale = 1.22; // a hair over the 1.20 minimum, so no edge can creep in
  const cw = Math.round(W * scale);
  const ch = Math.round(H * scale);

  const camId = await addShared(sceneName, 'Camera');
  await obs.call('SetSceneItemTransform', {
    sceneName,
    sceneItemId: camId,
    sceneItemTransform: {
      positionX: Math.round(camCentre - cw / 2),
      positionY: Math.round((H - ch) / 2),
      alignment: 5,
      boundsType: 'OBS_BOUNDS_SCALE_INNER',
      boundsAlignment: 0,
      boundsWidth: cw,
      boundsHeight: ch,
    },
  });

  // The share as a card in the LOWER right: his face sits upper-left of centre,
  // so dropping the card low keeps it clear of his face while still overlapping
  // his shoulder — which is what makes it read as floating in the room rather
  // than pasted on.
  const fw = Math.round(W * 0.52);
  const fh = Math.round((fw * 9) / 16);
  const fx = W - fw - Math.round(W * 0.031);
  const fy = H - fh - Math.round(H * 0.044);
  const pad = 8;

  await obs.call('CreateInput', {
    sceneName,
    inputName: 'Float Plate',
    inputKind: 'color_source_v3',
    inputSettings: { color: 0xf00a0a0e, width: fw + pad * 2, height: fh + pad * 2 },
  });
  const { sceneItemId: plateId } = await obs.call('GetSceneItemId', {
    sceneName,
    sourceName: 'Float Plate',
  });
  await obs.call('SetSceneItemTransform', {
    sceneName,
    sceneItemId: plateId,
    sceneItemTransform: { positionX: fx - pad, positionY: fy - pad, alignment: 5 },
  });

  const screenId = await addShared(sceneName, 'Display');
  await fit(sceneName, screenId, fx, fy, fw, fh);
  await addShared(sceneName, 'Mic');
  console.log(`Scene "${sceneName}" — full bleed, he sits at x~${camCentre} (${scale}x), card ${fw}x${fh} at ${fx},${fy}.`);
}

/**
 * CUTOUT — make the background-removed camera actually remove the background.
 * Measured 2026-09-02: the Camera FX source had Background Removal disabled
 * and a green-screen Chroma Key enabled. There is no green screen; the key
 * punched holes in a house plant and left Ryan in the room. The remover is
 * royshil obs-backgroundremoval 1.1.13 (kind `background_removal`); on Apple
 * Silicon it runs on CoreML.
 *
 * MODEL, measured 2026-09-02 on the Cam Cutout scene with Ryan in frame
 * (evidence/2026-09-02/cutout-model-bakeoff.png, GetStats over 8 s each):
 *
 *   selfie_segmentation   30.0 fps   0/241 skipped   11.8 ms render   clean edge
 *   rvm_mobilenetv3_fp32  27.1 fps  21/240 skipped   36.6 ms          clean, but holes on some frames
 *   bria_rmbg_1_4_qint8    0.3 fps 267/269 skipped 3640 ms            cleanest, unusable live
 *   mediapipe / SINet / pphumanseg — room showed through or face destroyed
 *
 * selfie_segmentation is the only one that costs nothing at 30 fps.
 */
async function cutout() {
  const sourceName = 'Camera FX';
  const { filters } = await obs.call('GetSourceFilterList', { sourceName });
  for (const f of filters) {
    if (f.filterKind === 'chroma_key_filter_v2') {
      await obs.call('RemoveSourceFilter', { sourceName, filterName: f.filterName });
      console.log(`removed ${f.filterName} (no green screen here)`);
    }
  }
  const settings = {
    useGPU: 'coreml',
    model_select: 'models/selfie_segmentation.onnx',
    threshold: 0.5,
    contour_filter: 0.05,
    smooth_contour: 0.5,
    feather: 0.05,
    temporal_smooth_factor: 0.85,
    mask_every_x_frames: 1,
    enable_threshold: true,
    enable_image_similarity: false,
    numThreads: 1,
  };
  const existing = filters.find((f) => f.filterKind === 'background_removal');
  if (existing) {
    await obs.call('SetSourceFilterSettings', { sourceName, filterName: existing.filterName, filterSettings: settings });
    await obs.call('SetSourceFilterEnabled', { sourceName, filterName: existing.filterName, filterEnabled: true });
  } else {
    await obs.call('CreateSourceFilter', { sourceName, filterName: 'Background Removal', filterKind: 'background_removal', filterSettings: settings });
  }
  console.log('Camera FX: Background Removal ON (coreml, selfie_segmentation).');
}

/**
 * CAMERA ISO — a clean camera-only file beside every screen recording.
 *
 * Ryan edits several snippets together in Resolve, and a camera track that is
 * separate from the screen means every reframe (bubble ↔ full-bleed ↔ cutout)
 * is an edit decision, not a re-shoot. Exeldro's Source Record 0.4.8 filter on
 * the shared Camera input records whenever the MAIN recording runs (mode 3),
 * with the same Apple VT h264 + AAC the main file uses, so ingest already
 * understands it. Files land in <record dir>/iso/ with a -cam suffix. Mic is
 * carried on the ISO too, so the file cuts on its own.
 */
async function cameraIso() {
  const sourceName = 'Camera';
  const filterName = 'Camera ISO';
  const { recordDirectory } = await obs.call('GetRecordDirectory');
  const settings = {
    record_mode: 3, // OUTPUT_MODE_RECORDING — follows the main recording
    path: `${recordDirectory}/iso`,
    filename_formatting: '%CCYY-%MM-%DD_%hh-%mm-%ss-cam',
    rec_format: 'mp4',
    encoder: 'com.apple.videotoolbox.videoencoder.ave.avc',
    different_audio: true,
    audio_source: 'Mic',
    audio_encoder: 'CoreAudio_AAC',
    audio_track: 1,
    scale: false,
  };
  const { filters } = await obs.call('GetSourceFilterList', { sourceName });
  const existing = filters.find((f) => f.filterKind === 'source_record_filter');
  if (existing) {
    await obs.call('SetSourceFilterSettings', { sourceName, filterName: existing.filterName, filterSettings: settings });
    await obs.call('SetSourceFilterEnabled', { sourceName, filterName: existing.filterName, filterEnabled: true });
  } else {
    await obs.call('CreateSourceFilter', { sourceName, filterName, filterKind: 'source_record_filter', filterSettings: settings });
  }
  console.log(`Camera ISO: records to ${settings.path} whenever the main recording runs.`);
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
