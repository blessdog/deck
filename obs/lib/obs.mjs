import OBSWebSocket from 'obs-websocket-js';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { execSync } from 'node:child_process';

const CONFIG_PATH = `${homedir()}/Library/Application Support/obs-studio/plugin_config/obs-websocket/config.json`;

// Single source of truth for the websocket port/password: OBS's own config file.
export function obsWebsocketConfig() {
  const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  if (!cfg.server_enabled) {
    throw new Error(`obs-websocket server is disabled in ${CONFIG_PATH}`);
  }
  return { port: cfg.server_port, password: cfg.server_password };
}

export function obsIsRunning() {
  try {
    execSync('pgrep -x OBS', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function launchOBS(args = []) {
  const quoted = args.map((a) => `"${a}"`).join(' ');
  execSync(`open -a OBS ${args.length ? `--args ${quoted}` : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Active displays from CoreGraphics: [{id, uuid, builtin}].
 * obs-websocket's own display enumeration for screen_capture hangs on
 * OBS 32.1.x, so displays are sourced from the OS instead.
 */
export function displayUUIDs() {
  const out = execSync(
    `python3 "${new URL('./display-uuids.py', import.meta.url).pathname}"`,
    { encoding: 'utf8' }
  );
  return JSON.parse(out);
}

/**
 * Connect to OBS, optionally launching it first and waiting for the
 * websocket server to come up.
 */
export async function connect({ launch = false, launchArgs = [], timeoutMs = 30000 } = {}) {
  const { port, password } = obsWebsocketConfig();
  const obs = new OBSWebSocket();
  const deadline = Date.now() + timeoutMs;

  if (launch && !obsIsRunning()) {
    console.log('Launching OBS…');
    launchOBS(launchArgs);
  }

  for (;;) {
    try {
      await obs.connect(`ws://127.0.0.1:${port}`, password);
      // The socket comes up before OBS finishes initializing (error 207
      // "not ready" on real requests) — poll until it answers.
      for (;;) {
        try {
          await obs.call('GetSceneCollectionList');
          return obs;
        } catch (err) {
          if (err.code !== 207 || Date.now() > deadline) throw err;
          await sleep(500);
        }
      }
    } catch (err) {
      if (Date.now() > deadline) {
        throw new Error(
          `Could not reach obs-websocket on port ${port} within ${timeoutMs / 1000}s. ` +
            `Is OBS running? (${err.message ?? err})`
        );
      }
      await sleep(1000);
    }
  }
}
