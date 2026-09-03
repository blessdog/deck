#!/usr/bin/env node
/**
 * Rebuild every macOS Screen Capture stream in OBS.
 *
 * MECHANISM (measured 2026-09-03): after a night of sleep/wake cycles, OBS's
 * ScreenCaptureKit streams kept delivering the desktop wallpaper only — no
 * windows — while every permission read "granted" and the approval file said
 * OBS's next reminder was two months away. Re-applying identical settings did
 * nothing (OBS no-ops an unchanged update). Pointing each source at ANOTHER
 * display and back forces a new stream, and both screens came back clean
 * (Screen L 81 → 3.3 against the OS's own capture). The 2026-08-01 diagnosis
 * "stale Screen Recording grant, toggle it" was half right: the toggle worked
 * because it relaunched OBS, which rebuilt the streams.
 *
 *   node obs/heal-screens.mjs          # rebuild, then measure with check-screens
 */
import { connect, displayUUIDs } from './lib/obs.mjs';

export async function healScreens(obs, log = console.log) {
  const { inputs } = await obs.call('GetInputList', { inputKind: 'screen_capture' });
  if (!inputs.length) return 0;
  const uuids = displayUUIDs().map((d) => (typeof d === 'string' ? d : d.uuid));
  const originals = [];
  for (const { inputName } of inputs) {
    const { inputSettings } = await obs.call('GetInputSettings', { inputName });
    const current = inputSettings.display_uuid;
    const other = uuids.find((u) => u !== current) ?? current;
    originals.push({ inputName, current });
    await obs.call('SetInputSettings', { inputName, inputSettings: { display_uuid: other } });
  }
  await new Promise((r) => setTimeout(r, 2000));
  for (const { inputName, current } of originals) {
    await obs.call('SetInputSettings', { inputName, inputSettings: { display_uuid: current } });
    log(`rebuilt capture stream: ${inputName}`);
  }
  return originals.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const obs = await connect();
  const n = await healScreens(obs);
  await obs.disconnect();
  console.log(`${n} screen capture source(s) rebuilt — now run obs/check-screens.mjs`);
}
