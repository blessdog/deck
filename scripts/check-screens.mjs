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

const SCENES = [
  { scene: 'Screen L', display: 2 }, // external, x=-1920 (screencapture -D is 1-based, ordered by CoreGraphics)
  { scene: 'Screen R', display: 1 }, // built-in
];
const DIFF_STALE = 12; // mean abs pixel difference (0–255) on a 96x54 thumbnail; CHOSEN, read a few times and adjust
mkdirSync('evidence/screens-check', { recursive: true });
const obs = await connect();
let stale = 0;
for (const { scene, display } of SCENES) {
  const { imageData } = await obs.call('GetSourceScreenshot', { sourceName: scene, imageFormat: 'png', imageWidth: 960 });
  const obsPng = `evidence/screens-check/${scene.replace(/\W/g, '')}-obs.png`;
  const osPng = `evidence/screens-check/${scene.replace(/\W/g, '')}-os.png`;
  writeFileSync(obsPng, Buffer.from(imageData.split(',')[1], 'base64'));
  execFileSync('/usr/sbin/screencapture', ['-x', '-D', String(display), osPng]);
  const diff = parseFloat(
    execFileSync('/opt/homebrew/bin/magick', [obsPng, '-resize', '96x54!', osPng, '-resize', '96x54!', '-colorspace', 'gray', '-compose', 'difference', '-composite', '-format', '%[fx:mean*255]', 'info:']).toString(),
  );
  const verdict = diff > DIFF_STALE ? 'STALE' : 'ok';
  if (verdict === 'STALE') stale++;
  console.log(`${scene}: OBS vs OS mean diff ${diff.toFixed(1)} → ${verdict}`);
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
