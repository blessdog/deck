#!/usr/bin/env node
// The Display item in "Me + Float" must be a CARD over the camera, not the
// full frame. 2026-09-02: it was full-frame and the scene rendered as Screen L.
import { connect } from './lib/obs.mjs';
const obs = await connect();
const { sceneItems } = await obs.call('GetSceneItemList', { sceneName: 'Me + Float' });
await obs.disconnect();
const d = sceneItems.find((i) => i.sourceName === 'Display');
const cam = sceneItems.find((i) => i.sourceName === 'Camera');
const t = d?.sceneItemTransform;
const isCard = t && t.boundsWidth < 1200 && t.positionX > 600;
const camUnder = cam && d && cam.sceneItemIndex < d.sceneItemIndex;
console.log(`Display bounds ${t?.boundsWidth}x${t?.boundsHeight} at ${t?.positionX},${t?.positionY}; camera below display: ${camUnder}`);
if (!isCard || !camUnder) { console.error('✖ Me + Float is flattened — Display is full-frame or camera is on top'); process.exit(1); }
console.log('✓ Me + Float is a card over the camera');
