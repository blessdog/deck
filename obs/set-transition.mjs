#!/usr/bin/env node
/**
 * Make Move (Exeldro) the scene transition so camera looks slide instead of
 * cut. Cam, Me + Float and Screen + Cam share one Camera source, which is what
 * Move matches on, so nothing else changes.
 *
 * Move's own settings are applied too (SETTINGS below). Its defaults fly every
 * appearing source in from the left edge and every disappearing one out to the
 * right, with no fade — so CAM → SCREEN L had the display swoop in from the
 * side. Recipe from Nutty's Move master class (2026-09-08): position None for
 * appearing and disappearing items, Fade for matched, appearing and
 * disappearing. Then a source that is on both scenes still slides, and one
 * that is only on the new scene fades in where it belongs. Zoom is already off
 * in Move 3.2.1 (zoom_in/zoom_out default 0), so it is not set here.
 *
 * obs-websocket 5 cannot CREATE a transition, only select one. So:
 *   OBS running and Move already configured  → select it, set 350 ms, apply SETTINGS.
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

/**
 * Move's settings keys, from move-transition.h in exeldro/obs-move-transition.
 * position_*: bit flags, POS_NONE = 0 (default is edge|left = 6 in, edge|right
 * = 10 out). transition_*: the NAME of a frontend transition as OBS shows it
 * (Move compares with obs_source_get_name), not a kind id; "Fade" and "Cut"
 * always exist. One constant for both branches so they cannot drift.
 */
const SETTINGS = {
  position_in: 0,
  position_out: 0,
  transition_match: 'Fade',
  transition_in: 'Fade',
  transition_out: 'Fade',
};

if (!obsIsRunning()) {
  copyFileSync(COLLECTION, COLLECTION + '.pre-move.bak');
  const d = JSON.parse(readFileSync(COLLECTION, 'utf8'));
  const has = (d.transitions ?? []).some((t) => t.id === 'move_transition');
  if (!has) d.transitions = [...(d.transitions ?? []), { id: 'move_transition', name: 'Move', settings: {} }];
  const move = d.transitions.find((t) => t.id === 'move_transition');
  move.settings = { ...(move.settings ?? {}), ...SETTINGS };
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
await obs.call('SetCurrentSceneTransitionSettings', { transitionSettings: SETTINGS, overlay: true });
const { transitionName, transitionDuration, transitionSettings } = await obs.call('GetCurrentSceneTransition');
const missing = Object.entries(SETTINGS).filter(([k, v]) => transitionSettings[k] !== v);
if (missing.length) {
  console.error(`✖ OBS did not take: ${missing.map(([k]) => k).join(', ')} — now ${JSON.stringify(transitionSettings)}`);
  await obs.disconnect();
  process.exit(1);
}
console.log(`transition: ${transitionName}, ${transitionDuration} ms, ${JSON.stringify(transitionSettings)}`);
await obs.disconnect();
