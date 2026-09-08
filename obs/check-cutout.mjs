#!/usr/bin/env node
// Tripwire for the CUTOUT key and the Lava substrate. Two things must be true:
//
//  1. The CUTOUT latch works in place: with the Mac Vision filter on the
//     shared Camera enabled, the Cam scene has a real alpha hole where the room
//     was; with it disabled, the room is back. Ratio of transparent pixels is
//     the countable line. The Camera ISO recorder must NOT be on that input
//     (it records Camera Raw): Source Record renders its parent with every
//     filter on it, so an ISO taken from the latched Camera is a cutout too.
//  2. The Cam Cutout scene (Camera FX, always on — Lava Lounge's substrate)
//     still has its hole.
//
// Every scene is put ON PROGRAM before it is measured. Measured 2026-09-08: a
// screenshot of a scene while inactive returned a STALE mask (knowledge/
// cutout-mask-is-stale-while-inactive). Never switches while recording; the
// latch is left the way it was found.
//   node obs/check-cutout.mjs [outPath]
import { connect, refuseIfRecording } from './lib/obs.mjs';
import { SHARED_CAMERA, VISION_FILTER_NAME, latchIsIsolatedFromIso } from './lib/cutout.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const WARM_MS = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = process.argv[2] ?? 'evidence/cutout-check.png';
const outOf = (tag) => out.replace(/\.png$/, `-${tag}.png`);

const ratioOf = (path) => parseFloat(execFileSync('/opt/homebrew/bin/magick', [path, '-format', '%[fx:1-mean.a]', 'info:']).toString());

const obs = await connect();
const shots = {};
let failed = false;
try {
  await refuseIfRecording(obs, 'the cutout check switches program');
  const { currentProgramSceneName: before } = await obs.call('GetCurrentProgramScene');
  const { filterEnabled: latchBefore } = await obs.call('GetSourceFilter', { sourceName: SHARED_CAMERA, filterName: VISION_FILTER_NAME });

  if (!(await latchIsIsolatedFromIso(obs))) {
    console.error(`✖ the Camera ISO recorder sits on ${SHARED_CAMERA} or is missing from Camera Raw: the ISO would record the cutout. Run: node obs/add-look.mjs iso`);
    failed = true;
  }

  const shoot = async (scene, tag) => {
    await obs.call('SetCurrentProgramScene', { sceneName: scene });
    await sleep(WARM_MS);
    const { imageData } = await obs.call('GetSourceScreenshot', { sourceName: scene, imageFormat: 'png', imageWidth: 480 });
    const path = outOf(tag);
    writeFileSync(path, Buffer.from(imageData.split(',')[1], 'base64'));
    shots[tag] = ratioOf(path);
    console.log(`${tag.padEnd(12)} transparent ratio ${shots[tag].toFixed(3)} (${path})`);
  };

  await obs.call('SetSourceFilterEnabled', { sourceName: SHARED_CAMERA, filterName: VISION_FILTER_NAME, filterEnabled: true });
  await shoot('Cam', 'latch-on');
  await obs.call('SetSourceFilterEnabled', { sourceName: SHARED_CAMERA, filterName: VISION_FILTER_NAME, filterEnabled: false });
  await shoot('Cam', 'latch-off');
  await shoot('Cam Cutout', 'lava');

  await obs.call('SetSourceFilterEnabled', { sourceName: SHARED_CAMERA, filterName: VISION_FILTER_NAME, filterEnabled: latchBefore });
  await obs.call('SetCurrentProgramScene', { sceneName: before });
} finally {
  await obs.disconnect();
}
if (shots['latch-on'] < 0.2) { console.error('✖ CUTOUT latch on: <20% of Cam is transparent — the shared Camera is not cutting'); failed = true; }
if (shots['latch-off'] > 0.05) { console.error('✖ CUTOUT latch off: Cam still has a hole — the filter did not release'); failed = true; }
if (shots['lava'] < 0.2) { console.error('✖ Cam Cutout (Lava substrate) is not cutting'); failed = true; }
if (failed) process.exit(1);
console.log('✓ cutout latches on and off in place, the ISO recorder is off the latched Camera, and Lava still has its hole');
