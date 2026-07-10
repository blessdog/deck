#!/usr/bin/env node
/**
 * Build the "Control Room" scene collection in OBS via obs-websocket.
 *
 * Scenes:
 *   Starting Soon  — dark background + title text
 *   Screen         — full display capture + mic
 *   Cam            — full camera + mic
 *   Screen + Cam   — display capture with camera bubble bottom-right + mic
 *   Ending         — dark background + "Thanks for watching"
 *
 * Idempotent: refuses to touch an existing "Control Room" collection
 * unless --force is passed (--force wipes and rebuilds its scenes).
 */
import { connect, displayUUIDs } from './lib/obs.mjs';

const COLLECTION = 'Control Room';
const FORCE = process.argv.includes('--force');

const SCENES = ['Starting Soon', 'Screen', 'Cam', 'Screen + Cam', 'Ending', 'Cam Cutout', 'Lava Lounge'];

// bongpot.com's lava lamp, looped as a virtual backdrop in "Lava Lounge"
const LAMP_VIDEO = '/Users/SSDrive/projects/bongpot/public/lamp-bg.mp4';

const obs = await connect({ launch: true });

try {
  const { sceneCollections, currentSceneCollectionName } =
    await obs.call('GetSceneCollectionList');

  if (sceneCollections.includes(COLLECTION)) {
    if (!FORCE) {
      console.error(
        `Scene collection "${COLLECTION}" already exists. Re-run with --force to wipe and rebuild it.`
      );
      process.exit(1);
    }
    if (currentSceneCollectionName !== COLLECTION) {
      await obs.call('SetCurrentSceneCollection', { sceneCollectionName: COLLECTION });
    }
    await wipeScenes();
  } else {
    // Creating a collection also switches to it; it starts with one default scene.
    await obs.call('CreateSceneCollection', { sceneCollectionName: COLLECTION });
  }

  const { baseWidth: W, baseHeight: H } = await obs.call('GetVideoSettings');
  console.log(`Canvas: ${W}x${H}`);

  for (const name of SCENES) {
    await obs.call('CreateScene', { sceneName: name });
    console.log(`Scene created: ${name}`);
  }

  // ---- Inputs (each created once, then shared across scenes — SSOT) ----

  // screen_capture ships with an empty display_uuid (renders nothing), so the
  // target display must be set explicitly. Sourced from CoreGraphics — asking
  // OBS to enumerate displays hangs on 32.1.x.
  const displays = displayUUIDs();
  const display = displays.find((d) => d.builtin) ?? displays[0];
  await obs.call('CreateInput', {
    sceneName: 'Screen',
    inputName: 'Display',
    inputKind: 'screen_capture',
    inputSettings: { display_uuid: display.uuid },
  });
  console.log(`Display: ${display.builtin ? 'built-in' : 'external'} (${display.uuid})`);

  await obs.call('CreateInput', {
    sceneName: 'Cam',
    inputName: 'Camera',
    inputKind: 'av_capture_input_v2',
    inputSettings: {},
  });
  // Prefer Continuity Camera (not Desk View); fall back to the built-in webcam.
  const cam = await pickFirstDevice('Camera', 'device', /^iphone camera$/i);
  if (cam) {
    await obs.call('SetInputSettings', {
      inputName: 'Camera',
      inputSettings: { device: cam.itemValue, use_preset: true },
    });
    console.log(`Camera device: ${cam.itemName}`);
  }

  await obs.call('CreateInput', {
    sceneName: 'Screen',
    inputName: 'Mic',
    inputKind: 'coreaudio_input_capture',
    inputSettings: { device_id: 'default' },
  });

  // ---- Wire shared sources into the other scenes ----

  await obs.call('CreateSceneItem', { sceneName: 'Cam', sourceName: 'Mic' });
  await obs.call('CreateSceneItem', { sceneName: 'Screen + Cam', sourceName: 'Display' });
  const { sceneItemId: bubbleId } = await obs.call('CreateSceneItem', {
    sceneName: 'Screen + Cam',
    sourceName: 'Camera',
  });
  await obs.call('CreateSceneItem', { sceneName: 'Screen + Cam', sourceName: 'Mic' });

  // Camera bubble: ~25% of canvas width, bottom-right, 24px margin.
  const margin = 24;
  const bw = Math.round(W * 0.25);
  const bh = Math.round((bw * 9) / 16);
  await obs.call('SetSceneItemTransform', {
    sceneName: 'Screen + Cam',
    sceneItemId: bubbleId,
    sceneItemTransform: {
      boundsType: 'OBS_BOUNDS_SCALE_INNER',
      boundsAlignment: 0,
      boundsWidth: bw,
      boundsHeight: bh,
      positionX: W - bw - margin,
      positionY: H - bh - margin,
      alignment: 5, // top-left anchor
    },
  });
  console.log(`Camera bubble: ${bw}x${bh} bottom-right`);

  // ---- Lava Lounge: bongpot lamp loop + background-removed camera ----
  // The cutout needs its OWN camera input: background_removal outputs black
  // with empty settings, and applied to a scene it renders a black silhouette.
  await obs.call('CreateInput', {
    sceneName: 'Cam Cutout',
    inputName: 'Camera FX',
    inputKind: 'av_capture_input_v2',
    inputSettings: cam ? { device: cam.itemValue, use_preset: true } : {},
  });
  const { defaultFilterSettings } = await obs.call('GetSourceFilterDefaultSettings', {
    filterKind: 'background_removal',
  });
  await obs.call('CreateSourceFilter', {
    sourceName: 'Camera FX',
    filterName: 'Background Removal',
    filterKind: 'background_removal',
    filterSettings: { ...defaultFilterSettings, threshold: 0.4 },
  });
  await obs.call('CreateInput', {
    sceneName: 'Lava Lounge',
    inputName: 'Lava Lamp',
    inputKind: 'ffmpeg_source',
    inputSettings: { local_file: LAMP_VIDEO, looping: true, hw_decode: true },
  });
  await obs.call('CreateSceneItem', { sceneName: 'Lava Lounge', sourceName: 'Cam Cutout' });
  await obs.call('CreateSceneItem', { sceneName: 'Lava Lounge', sourceName: 'Mic' });

  // ---- Holding scenes: background + centered text ----

  await makeHoldingScene('Starting Soon', 'Starting Soon…', 0xff2e1a1a, W, H);
  await makeHoldingScene('Ending', 'Thanks for watching', 0xff3e2116, W, H);

  // Drop the auto-created default scene, land on Starting Soon.
  const { scenes } = await obs.call('GetSceneList');
  for (const s of scenes) {
    if (!SCENES.includes(s.sceneName)) {
      await obs.call('RemoveScene', { sceneName: s.sceneName });
    }
  }
  await obs.call('SetCurrentProgramScene', { sceneName: 'Starting Soon' });

  console.log(`\nDone. "${COLLECTION}" is live with ${SCENES.length} scenes.`);
} finally {
  await obs.disconnect();
}

// ---------------------------------------------------------------------------

async function wipeScenes() {
  // Can't remove the last scene, so park on a temp one first.
  await obs.call('CreateScene', { sceneName: '__rebuild__' }).catch(() => {});
  const { scenes } = await obs.call('GetSceneList');
  for (const s of scenes) {
    if (s.sceneName !== '__rebuild__') {
      await obs.call('RemoveScene', { sceneName: s.sceneName });
    }
  }
  // Orphaned inputs survive scene removal; remove them so CreateInput can't collide.
  const { inputs } = await obs.call('GetInputList');
  for (const i of inputs) {
    await obs.call('RemoveInput', { inputName: i.inputName }).catch(() => {});
  }
  console.log('Wiped existing scenes/inputs (--force).');
}

async function pickFirstDevice(inputName, propertyName, preferRe) {
  try {
    const { propertyItems } = await obs.call('GetInputPropertiesListPropertyItems', {
      inputName,
      propertyName,
    });
    const enabled = propertyItems.filter((i) => i.itemEnabled !== false && i.itemValue);
    return enabled.find((i) => preferRe.test(i.itemName)) ?? enabled[0] ?? null;
  } catch {
    return null;
  }
}

async function makeHoldingScene(sceneName, text, abgrColor, W, H) { // color is 0xAABBGGRR
  await obs.call('CreateInput', {
    sceneName,
    inputName: `${sceneName} BG`,
    inputKind: 'color_source_v3',
    inputSettings: { color: abgrColor, width: W, height: H },
  });
  const { sceneItemId } = await obs.call('CreateInput', {
    sceneName,
    inputName: `${sceneName} Text`,
    inputKind: 'text_ft2_source_v2',
    inputSettings: {
      text,
      font: { face: 'Helvetica', size: Math.round(H / 10), style: 'Bold' },
      color1: 0xffffffff,
      color2: 0xffffffff,
    },
  });
  await obs.call('SetSceneItemTransform', {
    sceneName,
    sceneItemId,
    sceneItemTransform: { positionX: W / 2, positionY: H / 2, alignment: 0 }, // centered
  });
}
