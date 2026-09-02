#!/usr/bin/env node
/**
 * Save a PNG of a scene's program output (default: current scene).
 *
 *   node obs/snapshot.mjs [sceneName] [outPath]
 */
import { connect } from './lib/obs.mjs';
import { writeFileSync } from 'node:fs';

const sceneName = process.argv[2];
const outPath = process.argv[3] ?? `snapshot.png`;

const obs = await connect();
try {
  const name =
    sceneName ?? (await obs.call('GetCurrentProgramScene')).currentProgramSceneName;
  const { imageData } = await obs.call('GetSourceScreenshot', {
    sourceName: name,
    imageFormat: 'png',
    imageWidth: 960,
  });
  writeFileSync(outPath, Buffer.from(imageData.split(',')[1], 'base64'));
  console.log(`${name} -> ${outPath}`);
} finally {
  await obs.disconnect();
}
