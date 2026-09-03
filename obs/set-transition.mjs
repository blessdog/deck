#!/usr/bin/env node
/**
 * Make Move (Exeldro) the scene transition so camera looks slide instead of
 * cut. Cam, Me + Float and Screen + Cam share one Camera source, which is what
 * Move matches on, so nothing else changes.
 *
 * obs-websocket 5 cannot CREATE a transition, only select one. So:
 *   OBS running and Move already configured  → select it, set 350 ms.
 *   OBS running, Move missing                → quit OBS and re-run.
 *   OBS quit                                 → write Move into the scene
 *                                              collection file (backed up
 *                                              first), then relaunch.
 *
 *   node obs/set-transition.mjs
 */
import { connect, obsIsRunning, launchOBS } from './lib/obs.mjs';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const COLLECTION = join(homedir(), 'Library/Application Support/obs-studio/basic/scenes/Control_Room.json');
const DURATION_MS = 350;

if (!obsIsRunning()) {
  copyFileSync(COLLECTION, COLLECTION + '.pre-move.bak');
  const d = JSON.parse(readFileSync(COLLECTION, 'utf8'));
  const has = (d.transitions ?? []).some((t) => t.id === 'move_transition');
  if (!has) d.transitions = [...(d.transitions ?? []), { id: 'move_transition', name: 'Move', settings: {} }];
  d.current_transition = 'Move';
  d.transition_duration = DURATION_MS;
  writeFileSync(COLLECTION, JSON.stringify(d, null, 4));
  console.log(`collection: Move ${has ? 'kept' : 'added'}, current=Move, ${DURATION_MS} ms. Launching OBS…`);
  launchOBS(['--collection', 'Control Room', '--scene', 'Starting Soon']);
  process.exit(0);
}

const obs = await connect();
const { transitions } = await obs.call('GetSceneTransitionList');
const move = transitions.find((t) => t.transitionKind === 'move_transition');
if (!move) {
  console.error('✖ Move is not configured in this collection. Quit OBS and re-run: this script writes it into the collection file, then relaunches.');
  await obs.disconnect();
  process.exit(1);
}
await obs.call('SetCurrentSceneTransition', { transitionName: move.transitionName });
await obs.call('SetCurrentSceneTransitionDuration', { transitionDuration: DURATION_MS });
const { transitionName, transitionDuration } = await obs.call('GetCurrentSceneTransition');
console.log(`transition: ${transitionName}, ${transitionDuration} ms`);
await obs.disconnect();
