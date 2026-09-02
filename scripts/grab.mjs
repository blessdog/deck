#!/usr/bin/env node
// GRAB — one key, any medium. Prompt for a URL, work out what it points at,
// and hand it to whichever tool owns that kind of media.
//
//   video  →  rectum fetch          (~/projects/mediaStudio/rectum)   clip library
//   image  →  fetch-image           (~/projects/media-tools)          image library
//
// WHY THE DISPATCH LIVES HERE and not in either tool: rectum owns capture and
// the clip library, media-tools owns renderers and the image library, and
// neither may depend on the other. obs-control-room is already the composition
// layer — "the plugin owns the key and its face; rectum owns capture and the
// library" (plugin.js, 2026-08-04). A router that calls two CLIs is exactly
// what a composition layer is for. Put it inside rectum and rectum grows an
// image library it does not own; put it inside media-tools and media-tools
// breaks its own law that no tool invokes another tool.
//
// PRE-FILL, and the lesson it has to respect. rectum learned on 2026-08-03 that
// the clipboard is the wrong default for VIDEO: it holds whatever was copied
// last, so standing on a YouTube page offered an Instagram URL from twenty
// minutes ago, and "a stale URL that looks plausible is worse than an empty
// box — you press Enter on it."
//
// But for IMAGES the clipboard is right, because the way you get an image URL
// is right-click → Copy Image Address. The front tab URL is the *page*, not the
// picture. So the rule is narrow enough to keep both true:
//
//   clipboard wins ONLY when it holds a URL ending in an image extension.
//   otherwise the front browser tab wins, exactly as before.
//
// And when the two differ, the page URL rides along as --source-page. That is
// free provenance: the image knows which page it was found on.
//
// usage: node grab.mjs [--url URL] [--out DIR] [--dry-run]

import { execFileSync, execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, extname, basename } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const DRY = args.includes('--dry-run');

// A deck key shows a red alert and the log is the only account of WHY. A raw
// V8 stack trace buries the one useful line — "HTTP 403 Forbidden" — under
// twenty frames of node internals, which is exactly what the first real press
// of this key produced. Fail in one line, with the child's own message.
function die(err) {
  const child = String(err?.stderr || '').trim().split('\n').filter(Boolean).pop();
  console.error(`grab failed: ${child || err?.message || String(err)}`);
  process.exit(1);
}
process.on('uncaughtException', die);
process.on('unhandledRejection', die);

const RECTUM = [join(homedir(), 'projects', 'mediaStudio', 'rectum'), join(homedir(), 'projects', 'rectum')]
  .find((p) => existsSync(join(p, 'rectum', '__main__.py')));
const MEDIA_TOOLS = join(homedir(), 'projects', 'media-tools');
const FETCH_IMAGE = join(MEDIA_TOOLS, 'tools', 'fetch-image.mjs');
const FIND_PAGE_IMAGE = join(MEDIA_TOOLS, 'tools', 'find-page-image.mjs');
const IMAGE_OUT = flag('--out', join(MEDIA_TOOLS, 'corpus', 'grabs'));

// The Stream Deck launches us with a bare PATH — no brew, so no python3, no
// node beyond the one running this, no yt-dlp. Same repair rectum does.
const PATH = `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ''}`;
const ENV = { ...process.env, PATH };
const PYTHON = ['/opt/homebrew/bin/python3', '/usr/bin/python3'].find((p) => existsSync(p)) || 'python3';

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|heic|heif|tiff?|bmp)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi|m3u8|mpd)(\?|#|$)/i;

// Hosts where the URL is a PAGE that contains a video. Content-Type says
// text/html for all of them, so the type sniff cannot help and the host list
// is the only signal. yt-dlp supports far more than this — these are the ones
// worth answering without a question.
const VIDEO_HOSTS = /(^|\.)(youtube\.com|youtu\.be|instagram\.com|tiktok\.com|x\.com|twitter\.com|vimeo\.com|reddit\.com|facebook\.com|twitch\.tv|dailymotion\.com|bsky\.app)$/i;

const osa = (script) => {
  try { return execFileSync('osascript', ['-e', script], { encoding: 'utf8', env: ENV }).trim(); }
  catch { return ''; }
};

// Only asks browsers that are ALREADY RUNNING — `tell application "X"` will
// launch X otherwise, and a key that boots Safari because you pressed it is its
// own bug. Ported from rectum's fetch.active_tab_url; keep the list in step.
const BROWSERS = ['Brave Browser', 'Google Chrome', 'Arc', 'Safari'];
function activeTabUrl() {
  for (const app of BROWSERS) {
    const get = app === 'Safari'
      ? 'tell application "Safari" to get URL of front document'
      : `tell application "${app}" to get URL of active tab of front window`;
    const url = osa(`if application "${app}" is running then\n  try\n    ${get}\n  end try\nend if`);
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
  }
  return '';
}

function clipboardUrl() {
  try {
    const first = execFileSync('pbpaste', { encoding: 'utf8', env: ENV }).split('\n')[0].trim();
    return /^https?:\/\//.test(first) ? first : '';
  } catch { return ''; }
}

function ask(prefill) {
  const script = 'display dialog "Paste a URL — video or image, it works out which" '
    + `default answer ${JSON.stringify(prefill)} `
    + 'with title "grab" buttons {"Cancel", "Grab"} default button "Grab"';
  let res;
  try { res = execFileSync('osascript', ['-e', script], { encoding: 'utf8', env: ENV }); }
  catch { return null; }                                    // Cancel or Escape
  const m = res.match(/text returned:(.*?)(?:, button returned:|$)/s);
  return m ? (m[1].trim() || null) : null;
}

// Pick one of many images on a page. `choose from list` rather than a numbered
// dialog: it scrolls, it filters as you type, and it is the same widget macOS
// uses everywhere else.
function chooseImage(cands) {
  const labels = cands.map((c, i) => `${i + 1}. ${(c.caption || c.alt || c.url.split('/').pop()).slice(0, 90)}`);
  const script = 'choose from list ' + JSON.stringify(labels).replace(/^\[/, '{').replace(/\]$/, '}')
    + ' with title "grab" with prompt "Which image?" OK button name "Grab" cancel button name "Cancel"';
  try {
    const out = execFileSync('osascript', ['-e', script], { encoding: 'utf8', env: ENV }).trim();
    if (!out || out === 'false') return null;
    const n = parseInt(out, 10);
    return Number.isFinite(n) && n >= 1 && n <= cands.length ? cands[n - 1] : null;
  } catch { return null; }
}

// A page is not an image. Standing on a gallery and pressing GRAB should get
// the picture, not the HTML — that is the normal case, and the first real press
// of this key (2026-08-13) failed on exactly it.
async function imageFromPage(pageUrl) {
  const { stdout } = await execFileAsync(process.execPath, [FIND_PAGE_IMAGE, '--url', pageUrl],
    { env: ENV, timeout: 60_000, maxBuffer: 1 << 24 });
  const { candidates = [] } = JSON.parse(stdout);
  if (!candidates.length) return null;
  // A fragment match means the page already told us which one. Do not ask.
  const top = candidates[0];
  if (/fragment/.test(top.why) || candidates.length === 1) return top;
  // A dry run must never pop a picker — it is meant to be scriptable. Report
  // the top candidate and say the choice was skipped.
  if (DRY) return { ...top, why: `${top.why} (top of ${candidates.length}; picker skipped for --dry-run)` };
  return chooseImage(candidates);
}

// Two buttons rather than a guess. Filing a painting in the clip library is a
// worse outcome than one extra press, and it is silent when it happens.
function askKind(url) {
  const script = `display dialog ${JSON.stringify(`Can't tell what this is:\n\n${url.slice(0, 120)}`)} `
    + 'with title "grab" buttons {"Cancel", "Image", "Video"} default button "Video"';
  try {
    const out = execFileSync('osascript', ['-e', script], { encoding: 'utf8', env: ENV });
    if (out.includes('button returned:Image')) return 'image';
    if (out.includes('button returned:Video')) return 'video';
  } catch { /* cancelled */ }
  return null;
}

// ─── what does this URL point at ────────────────────────────────────────────
async function classify(url) {
  let host = '';
  try { host = new URL(url).hostname; } catch { return { kind: null, why: 'not a URL' }; }

  if (IMAGE_EXT.test(url)) return { kind: 'image', why: 'image extension' };
  if (VIDEO_EXT.test(url)) return { kind: 'video', why: 'video extension' };
  if (VIDEO_HOSTS.test(host)) return { kind: 'video', why: `known video host (${host})` };

  // Ask the server. HEAD is cheap and most CDNs answer it; some refuse, and a
  // refusal is not an error here — it just means we fall through to asking.
  try {
    const res = await fetch(url, {
      method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(12000),
      headers: { 'User-Agent': 'media-tools/0.1 (grab)' },
    });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.startsWith('image/')) return { kind: 'image', why: `Content-Type ${ct}` };
    if (ct.startsWith('video/')) return { kind: 'video', why: `Content-Type ${ct}` };
    if (ct.startsWith('text/html')) return { kind: null, why: 'a web page, and not a host we know' };
    if (ct) return { kind: null, why: `Content-Type ${ct}` };
  } catch (e) {
    return { kind: null, why: `HEAD failed (${String(e.message).slice(0, 60)})` };
  }
  return { kind: null, why: 'no Content-Type' };
}

// ─── main ───────────────────────────────────────────────────────────────────
const page = activeTabUrl();
const clip = clipboardUrl();
// The narrow exception: a copied image address beats the page you are standing
// on. Everything else keeps rectum's rule.
const prefill = IMAGE_EXT.test(clip) ? clip : (page || clip);

// A URL passed on the command line has nothing to do with whatever tab happens
// to be open, so the page only counts as provenance when the prompt supplied it.
const explicitUrl = flag('--url');
const url = explicitUrl || ask(prefill);
if (!url) { console.log('cancelled'); process.exit(0); }
const foundOn = explicitUrl ? '' : page;

let { kind, why } = await classify(url);

// A page that is not a known video host: look inside it before asking anything.
// Almost always this is a gallery and the answer is in there.
let target = url;             // what actually gets downloaded
let caption = '';             // whatever the page calls it
let pageOf = foundOn;         // the page it was found on, for provenance

if (!kind && /web page/.test(why)) {
  console.error(`page: looking for images in ${url.slice(0, 80)}…`);
  const hit = await imageFromPage(url);
  if (hit) {
    kind = 'image';
    why = `found in page (${hit.why})`;
    target = hit.url;
    caption = hit.caption || hit.alt || '';
    pageOf = url;
  } else {
    why = 'a web page with no image worth taking';
  }
}

if (!kind) {
  console.error(`ambiguous: ${why}`);
  if (DRY) { console.log(JSON.stringify({ url, kind: null, why })); process.exit(0); }
  kind = askKind(url);
  if (!kind) { console.log('cancelled'); process.exit(0); }
  why = 'you said so';
}
console.error(`${kind}: ${why}`);

if (DRY) { console.log(JSON.stringify({ url, target, kind, why, caption, page, prefill, out: IMAGE_OUT })); process.exit(0); }

if (kind === 'video') {
  if (!RECTUM) { console.error('rectum not found'); process.exit(1); }
  // rectum files it, hashes it, and reveals it in the Finder itself.
  const { stdout, stderr } = await execFileAsync(PYTHON, ['-m', 'rectum', 'fetch', target],
    { cwd: RECTUM, env: ENV, timeout: 900_000, maxBuffer: 1 << 24 });
  if (stderr) process.stderr.write(stderr);
  process.stdout.write(stdout);
} else {
  if (!existsSync(FETCH_IMAGE)) { console.error(`fetch-image not found at ${FETCH_IMAGE}`); process.exit(1); }
  // The page is free provenance — but only when it is not the image URL itself.
  const src = pageOf && pageOf !== target ? ['--source-page', pageOf] : [];
  // A scraped caption is the page's claim, not yours, so it is recorded as the
  // title AND said out loud in the note. Otherwise "asserted" would quietly
  // mean "some gallery's alt text" on half the library.
  const cap = caption ? ['--title', caption, '--note', 'title taken from the source page caption; not verified'] : [];
  const { stdout, stderr } = await execFileAsync(process.execPath,
    [FETCH_IMAGE, '--url', target, '--out', IMAGE_OUT, ...src, ...cap],
    { env: ENV, timeout: 300_000, maxBuffer: 1 << 24 });
  // Forward it: fetch-image's "no attribution given" warning and its duplicate
  // notice both live on stderr, and swallowing them turns a labelled grab and
  // an anonymous one into the same silent success.
  if (stderr) process.stderr.write(stderr);
  process.stdout.write(stdout);
  // rectum reveals its own downloads; fetch-image deliberately does not — a
  // tool with no side effects beyond its named outputs cannot open a Finder
  // window. So the caller does it, and the proof of a successful grab is the
  // file sitting selected in the folder rather than a notification about it.
  let landed = '';
  try { landed = JSON.parse(stdout).file || JSON.parse(stdout).existing || ''; } catch { /* not JSON */ }
  if (landed) execFileSync('open', ['-R', landed.startsWith('/') ? landed : join(MEDIA_TOOLS, landed)], { env: ENV });
}
