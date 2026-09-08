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
 * that is only on the new scene fades in where it belongs. Zoom (a 0–200 %
 * slider in 3.2.1, the old checkbox) defaults to 0 = off, and is pinned to 0
 * here anyway so the dialog cannot say otherwise.
 *
 * EVERY Move transition in the collection gets SETTINGS, not just one. On
 * 2026-09-08 Ryan added "Move (2)" by hand from the + button and made it
 * current; the recipe had been written into "Move", so nothing he could see
 * had changed. obs-websocket can only set the CURRENT transition's settings,
 * so each Move is selected, written, read back, and then the one that was
 * current (or the first Move) is selected again.
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
import { connect, obsIsRunning, launchOBS, refuseIfRecording } from './lib/obs.mjs';
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
  zoom_in: 0,
  zoom_out: 0,
  transition_match: 'Fade',
  transition_in: 'Fade',
  transition_out: 'Fade',
};

if (!obsIsRunning()) {
  copyFileSync(COLLECTION, COLLECTION + '.pre-move.bak');
  const d = JSON.parse(readFileSync(COLLECTION, 'utf8'));
  const has = (d.transitions ?? []).some((t) => t.id === 'move_transition');
  if (!has) d.transitions = [...(d.transitions ?? []), { id: 'move_transition', name: 'Move', settings: {} }];
  const moves = d.transitions.filter((t) => t.id === 'move_transition');
  for (const m of moves) m.settings = { ...(m.settings ?? {}), ...SETTINGS };
  if (!moves.some((m) => m.name === d.current_transition)) d.current_transition = moves[0].name;
  d.transition_duration = DURATION_MS;
  writeFileSync(COLLECTION, JSON.stringify(d, null, 4));
  console.log(`collection: Move ${has ? 'kept' : 'added'}, current=Move, ${DURATION_MS} ms. Launching OBS…`);
  launchOBS(['--collection', 'Control Room', '--scene', 'Starting Soon']);
  process.exit(0);
}

const obs = await connect();
await refuseIfRecording(obs, 'changing the transition changes how the next switch looks in the file');
const { transitions, currentSceneTransitionName } = await obs.call('GetSceneTransitionList');
const moves = transitions.filter((t) => t.transitionKind === 'move_transition');
if (!moves.length) {
  console.error('✖ Move is not configured in this collection. Quit OBS and re-run: this script writes it into the collection file, then relaunches.');
  await obs.disconnect();
  process.exit(1);
}
const keep = moves.find((m) => m.transitionName === currentSceneTransitionName) ?? moves[0];
for (const m of [...moves.filter((x) => x !== keep), keep]) {
  await obs.call('SetCurrentSceneTransition', { transitionName: m.transitionName });
  await obs.call('SetCurrentSceneTransitionSettings', { transitionSettings: SETTINGS, overlay: true });
  const { transitionSettings } = await obs.call('GetCurrentSceneTransition');
  const missing = Object.entries(SETTINGS).filter(([k, v]) => transitionSettings[k] !== v);
  if (missing.length) {
    console.error(`✖ ${m.transitionName}: OBS did not take ${missing.map(([k]) => k).join(', ')} — now ${JSON.stringify(transitionSettings)}`);
    await obs.disconnect();
    process.exit(1);
  }
  console.log(`${m.transitionName}: ${JSON.stringify(transitionSettings)}`);
}
await obs.call('SetCurrentSceneTransitionDuration', { transitionDuration: DURATION_MS });
const { transitionName, transitionDuration } = await obs.call('GetCurrentSceneTransition');
console.log(`current transition: ${transitionName}, ${transitionDuration} ms`);
await obs.disconnect();
