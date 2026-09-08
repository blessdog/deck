// The one place the cutout's remover is named. add-look.mjs (repair) and
// setup-scenes.mjs (first build) both read it, so the filter cannot drift
// between the two paths. Measured 2026-09-08, knowledge/cutout-runs-on-apple-vision.md.
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
