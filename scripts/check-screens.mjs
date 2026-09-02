#!/usr/bin/env node
/**
 * Tripwire for the stale Screen Recording grant. macOS keeps the grant against
 * OBS's code signature, so an OBS update leaves the toggle reading "on" while
 * ScreenCaptureKit hands OBS a stream containing only the desktop picture. It
 * does not go black; every machine-side check passes. Recurred 2026-09-02 on
 * 32.2.2 after being documented on 2026-08-01.
 *
 * Verify by exercising: capture the same display two ways — through OBS
 * (GetSourceScreenshot of Screen L / Screen R) and through the OS
 * (screencapture, which always sees windows) — and compare. If the OS picture
 * has content the OBS picture lacks, the grant is stale.
 *
 *   node scripts/check-screens.mjs            # both screens
 *   exit 1 = stale grant; the fix is printed.
 */
import { connect } from './lib/obs.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

// screencapture's -D numbering does not match CoreGraphics' order (measured
// 2026-09-02: -D 2 was the built-in, not the external), so no mapping is
// trusted: each OBS scene is compared against EVERY display and the closest
// wins. A stale grant makes every display far from every scene.
const SCENES = ['Screen L', 'Screen R'];
const DISPLAYS = [1, 2];
const DIFF_STALE = 40; // mean abs difference (0–255) on a 96x54 grey thumbnail. Measured: real match ≈ 5–15, wallpaper-vs-windows ≈ 145. CHOSEN at 40.
mkdirSync('evidence/screens-check', { recursive: true });
const osPng = (d) => `evidence/screens-check/display-${d}-os.png`;
for (const d of DISPLAYS) execFileSync('/usr/sbin/screencapture', ['-x', '-D', String(d), osPng(d)]);
const diffOf = (a, b) =>
  parseFloat(execFileSync('/opt/homebrew/bin/magick', [a, '-resize', '96x54!', b, '-resize', '96x54!', '-colorspace', 'gray', '-compose', 'difference', '-composite', '-format', '%[fx:mean*255]', 'info:']).toString());
const obs = await connect();
let stale = 0;
for (const scene of SCENES) {
  const { imageData } = await obs.call('GetSourceScreenshot', { sourceName: scene, imageFormat: 'png', imageWidth: 960 });
  const obsPng = `evidence/screens-check/${scene.replace(/\W/g, '')}-obs.png`;
  writeFileSync(obsPng, Buffer.from(imageData.split(',')[1], 'base64'));
  const diffs = DISPLAYS.map((d) => ({ d, diff: diffOf(obsPng, osPng(d)) }));
  const best = diffs.reduce((m, x) => (x.diff < m.diff ? x : m));
  const verdict = best.diff > DIFF_STALE ? 'STALE' : 'ok';
  if (verdict === 'STALE') stale++;
  console.log(`${scene}: closest OS display ${best.d}, mean diff ${best.diff.toFixed(1)} (all: ${diffs.map((x) => x.diff.toFixed(0)).join('/')}) → ${verdict}`);
}
await obs.disconnect();
if (stale) {
  console.error(
    `\n✖ OBS is capturing the wallpaper, not the screen (${stale} display(s)).\n` +
      `  Fix: System Settings → Privacy & Security → Screen & System Audio Recording →\n` +
      `  toggle OBS OFF then ON, then quit and relaunch OBS. Opening the pane:\n` +
      `  open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"`,
  );
  process.exit(1);
}
console.log('✓ OBS sees what the OS sees');
