#!/usr/bin/env node
// Tripwire for the CUTOUT key: the Cam Cutout scene must have a real alpha
// hole where the room was. Ratio of transparent pixels is the countable line.
//
// The scene is put ON PROGRAM before it is measured. Measured 2026-09-08: a
// screenshot of the scene while inactive returned a STALE mask — a
// person-shaped hole over a frame of the empty room (0.727), and once no mask
// at all (0.000) — while the same scene 3 s after going live measured 0.999.
// The background-removal filter only refreshes its mask while the source is
// actively rendering, like the screen captures (knowledge/
// cutout-mask-is-stale-while-inactive). Never switches while recording.
//   node obs/check-cutout.mjs [outPath]
import { connect } from './lib/obs.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const SCENE = 'Cam Cutout';
const WARM_MS = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const obs = await connect();
let imageData;
try {
  const { outputActive } = await obs.call('GetRecordStatus');
  const { currentProgramSceneName: before } = await obs.call('GetCurrentProgramScene');
  const switched = !outputActive && before !== SCENE;
  if (outputActive && before !== SCENE) console.log(`recording is live on ${before}: measuring ${SCENE} inactive (mask may be stale)`);
  if (switched) {
    await obs.call('SetCurrentProgramScene', { sceneName: SCENE });
    await sleep(WARM_MS);
  }
  ({ imageData } = await obs.call('GetSourceScreenshot', { sourceName: SCENE, imageFormat: 'png', imageWidth: 480 }));
  if (switched) await obs.call('SetCurrentProgramScene', { sceneName: before });
} finally {
  await obs.disconnect();
}
const out = process.argv[2] ?? 'evidence/cutout-check.png';
writeFileSync(out, Buffer.from(imageData.split(',')[1], 'base64'));
const ratio = parseFloat(execFileSync('/opt/homebrew/bin/magick', [out, '-format', '%[fx:1-mean.a]', 'info:']).toString());
console.log(`transparent ratio ${ratio.toFixed(3)} (${out})`);
if (ratio < 0.2) { console.error('✖ cutout is not cutting: <20% of the frame is transparent'); process.exit(1); }
console.log('✓ cutout has an alpha hole');
