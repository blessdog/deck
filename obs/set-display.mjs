#!/usr/bin/env node
/**
 * Point the shared "Display" source at a display.
 *
 *   node obs/set-display.mjs             # built-in display
 *   node obs/set-display.mjs --external  # first external display
 *
 * Display UUIDs come from CoreGraphics (lib/display-uuids.py) because
 * obs-websocket's display enumeration hangs on OBS 32.1.x.
 */
import { connect, displayUUIDs } from './lib/obs.mjs';

const wantExternal = process.argv.includes('--external');
const displays = displayUUIDs();
const pick =
  displays.find((d) => d.builtin !== wantExternal) ?? displays[0];
if (!pick) {
  console.error('No active displays found');
  process.exit(1);
}

const obs = await connect({ launch: true });
try {
  await obs.call('SetInputSettings', {
    inputName: 'Display',
    inputSettings: { display_uuid: pick.uuid },
  });
  console.log(
    `Display source now captures the ${pick.builtin ? 'built-in' : 'external'} display (${pick.uuid})`
  );
} finally {
  await obs.disconnect();
}
