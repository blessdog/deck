#!/usr/bin/env node
/**
 * Make Move (Exeldro) the scene transition so camera looks slide instead of
 * cut. Cam, Me + Float and Screen + Cam share one Camera source, which is what
 * Move matches on, so nothing else changes.
 *
 *   node obs/set-transition.mjs            # requires the Move plugin installed
 */
import { connect } from './lib/obs.mjs';
const obs = await connect();
const { transitions } = await obs.call('GetSceneTransitionList');
let move = transitions.find((t) => t.transitionKind === 'move_transition');
if (!move) {
  const kinds = [...new Set(transitions.map((t) => t.transitionKind))];
  console.error(`✖ Move transition is not installed (kinds present: ${kinds.join(', ')}). Run the .pkg in ~/Downloads with OBS quit.`);
  await obs.disconnect();
  process.exit(1);
}
await obs.call('SetCurrentSceneTransition', { transitionName: move.transitionName });
await obs.call('SetCurrentSceneTransitionDuration', { transitionDuration: 350 });
const { transitionName, transitionDuration } = await obs.call('GetCurrentSceneTransition');
console.log(`transition: ${transitionName}, ${transitionDuration} ms`);
await obs.disconnect();
