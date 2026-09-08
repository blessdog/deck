// The one place the cutout's remover is named. add-look.mjs (repair) and
// setup-scenes.mjs (first build) both call installCutout, so the filter cannot
// drift between the two paths. Measured 2026-09-08,
// knowledge/cutout-runs-on-apple-vision.md.
//
// The filter lives on TWO inputs:
//   - the shared Camera, DISABLED by default — the CUTOUT key latches it on,
//     so any scene showing the camera (Cam, Screen + Cam, Me + Float, React)
//     becomes a cutout in place.
//   - Camera FX, always ENABLED — Lava Lounge's substrate, untouched by the key.
//
// The Camera ISO recorder (Source Record) must NOT sit on the shared Camera:
// measured 2026-09-08, a 6 s take with the latch on gave an ISO that was also
// a cutout (near-black 0.797 in both files), because Source Record renders its
// PARENT source with every filter on it — order in the chain never mattered.
// So the ISO records a third input, Camera Raw, that no scene shows and no
// filter touches. latchIsIsolatedFromIso asserts that split.
export const SHARED_CAMERA = 'Camera';
export const CUTOUT_CAMERA = 'Camera FX';
export const ISO_CAMERA = 'Camera Raw';
/** The hidden holding scene Camera Raw lives in (an input must belong to a scene). */
export const RIG_SCENE = 'Rig';
export const ISO_FILTER_KIND = 'source_record_filter';
export const VISION_KIND = 'mac_vision_filter';
export const VISION_FILTER_NAME = 'Mac Vision';
export const VISION_SETTINGS = {
  quality: 1,          // 0 fast · 1 balanced · 2 accurate (accurate stair-steps the edge at scale 1.0)
  proc_scale: 0.5,
  threshold: 0.9,
  edge_smoothing: 0.5,
  edge_softness: 0.1,
  protect_enabled: false, // nothing (no mic, no desk) sits in front of Ryan
};

/** Install or repair the Vision filter on one input, last in the chain. */
export async function installCutout(obs, sourceName, { enabled }) {
  const { sourceFilterKinds } = await obs.call('GetSourceFilterKindList');
  if (!sourceFilterKinds.includes(VISION_KIND)) {
    throw new Error(`${VISION_KIND} is not loaded: install obs-mac-backgroundremoval (README → One-time setup) and restart OBS`);
  }
  const { filters } = await obs.call('GetSourceFilterList', { sourceName });
  const existing = filters.find((f) => f.filterKind === VISION_KIND);
  if (existing) {
    await obs.call('SetSourceFilterSettings', { sourceName, filterName: existing.filterName, filterSettings: VISION_SETTINGS });
    if (existing.filterName !== VISION_FILTER_NAME) {
      await obs.call('SetSourceFilterName', { sourceName, filterName: existing.filterName, newFilterName: VISION_FILTER_NAME });
    }
  } else {
    await obs.call('CreateSourceFilter', { sourceName, filterName: VISION_FILTER_NAME, filterKind: VISION_KIND, filterSettings: VISION_SETTINGS });
  }
  await obs.call('SetSourceFilterEnabled', { sourceName, filterName: VISION_FILTER_NAME, filterEnabled: enabled });
  const { filters: now } = await obs.call('GetSourceFilterList', { sourceName });
  return now.map((f) => f.filterName);
}

/** Install the Camera ISO recorder's input if missing: same device as the shared Camera, in the hidden Rig scene. */
export async function ensureIsoCamera(obs) {
  const { inputs } = await obs.call('GetInputList', { inputKind: 'av_capture_input_v2' });
  const { inputSettings } = await obs.call('GetInputSettings', { inputName: SHARED_CAMERA });
  if (!inputs.some((i) => i.inputName === ISO_CAMERA)) {
    const { scenes } = await obs.call('GetSceneList');
    if (!scenes.some((s) => s.sceneName === RIG_SCENE)) await obs.call('CreateScene', { sceneName: RIG_SCENE });
    await obs.call('CreateInput', { sceneName: RIG_SCENE, inputName: ISO_CAMERA, inputKind: 'av_capture_input_v2', inputSettings, sceneItemEnabled: false });
  } else {
    await obs.call('SetInputSettings', { inputName: ISO_CAMERA, inputSettings });
  }
}

/**
 * True when no recorder filter sits on the latched Camera and one sits on
 * Camera Raw — the split that keeps the ISO the raw room.
 */
export async function latchIsIsolatedFromIso(obs) {
  const { filters: onLatch } = await obs.call('GetSourceFilterList', { sourceName: SHARED_CAMERA });
  let onRaw = [];
  try { ({ filters: onRaw } = await obs.call('GetSourceFilterList', { sourceName: ISO_CAMERA })); } catch { return false; }
  return !onLatch.some((f) => f.filterKind === ISO_FILTER_KIND) && onRaw.some((f) => f.filterKind === ISO_FILTER_KIND && f.filterEnabled);
}
