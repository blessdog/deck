#!/usr/bin/env node
/**
 * One-time: point OBS at YouTube and set the stream key.
 *
 *   node scripts/set-stream-key.mjs <STREAM_KEY>
 *
 * The key is stored in OBS's own profile config, never in this repo.
 * Get it from YouTube Studio → Go Live → Stream settings.
 */
import { connect } from './lib/obs.mjs';

const key = process.argv[2];
if (!key) {
  console.error('Usage: node scripts/set-stream-key.mjs <STREAM_KEY>');
  process.exit(1);
}

const obs = await connect({ launch: true });
try {
  await obs.call('SetStreamServiceSettings', {
    streamServiceType: 'rtmp_common',
    streamServiceSettings: {
      service: 'YouTube - RTMPS',
      server: 'default',
      key,
    },
  });
  const { streamServiceSettings } = await obs.call('GetStreamServiceSettings');
  console.log(`Stream service set: ${streamServiceSettings.service} (key: ****${key.slice(-4)})`);
} finally {
  await obs.disconnect();
}
