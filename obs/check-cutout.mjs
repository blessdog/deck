#!/usr/bin/env node
// Tripwire for the CUTOUT key: the Cam Cutout scene must have a real alpha
// hole where the room was. Ratio of transparent pixels is the countable line.
//   node obs/check-cutout.mjs [outPath]
import { connect } from './lib/obs.mjs';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const obs = await connect();
const { imageData } = await obs.call('GetSourceScreenshot', { sourceName: 'Cam Cutout', imageFormat: 'png', imageWidth: 480 });
await obs.disconnect();
const out = process.argv[2] ?? 'evidence/cutout-check.png';
writeFileSync(out, Buffer.from(imageData.split(',')[1], 'base64'));
const ratio = parseFloat(execFileSync('/opt/homebrew/bin/magick', [out, '-format', '%[fx:1-mean.a]', 'info:']).toString());
console.log(`transparent ratio ${ratio.toFixed(3)} (${out})`);
if (ratio < 0.2) { console.error('✖ cutout is not cutting: <20% of the frame is transparent'); process.exit(1); }
console.log('✓ cutout has an alpha hole');
