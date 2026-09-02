#!/usr/bin/env node
/**
 * The 🚀 key: from "OBS not even running" to ready-to-go.
 *
 * - Launches OBS (into the Control Room collection) if it isn't running.
 * - Switches to the "Starting Soon" scene.
 * - Does NOT start the stream — going live is a deliberate second press.
 *   (--and-stream overrides that; --virtual-cam starts the virtual camera.)
 */
import { connect } from './lib/obs.mjs';

const COLLECTION = 'Control Room';
const HOME_SCENE = 'Starting Soon';
const AND_STREAM = process.argv.includes('--and-stream');
const VIRTUAL_CAM = process.argv.includes('--virtual-cam');

const obs = await connect({
  launch: true,
  launchArgs: ['--collection', COLLECTION, '--scene', HOME_SCENE],
});

try {
  const { currentSceneCollectionName } = await obs.call('GetSceneCollectionList');
  if (currentSceneCollectionName !== COLLECTION) {
    await obs.call('SetCurrentSceneCollection', { sceneCollectionName: COLLECTION });
  }
  await obs.call('SetCurrentProgramScene', { sceneName: HOME_SCENE });

  if (VIRTUAL_CAM) {
    const { outputActive } = await obs.call('GetVirtualCamStatus');
    if (!outputActive) await obs.call('StartVirtualCam');
  }
  if (AND_STREAM) {
    const { outputActive } = await obs.call('GetStreamStatus');
    if (!outputActive) await obs.call('StartStream');
  }

  console.log(`OBS ready on "${HOME_SCENE}"${VIRTUAL_CAM ? ' + virtual cam' : ''}${AND_STREAM ? ' + LIVE' : ''}`);
} finally {
  await obs.disconnect();
}
