---
id: screen-capture-streams-die-overnight
kind: verdict
conflict-key: why-does-obs-screen-share-show-only-the-wallpaper
status: live
supersedes: []
scope: OBS 32.2.x macOS Screen Capture (ScreenCaptureKit) on macOS 26, this Mac, OBS left running across sleep
evidence: obs/check-screens.mjs readings 2026-09-03 — 81/75 stale before, 3.3/13.4 after the stream rebuild, no permission touched
verified-on: 2026-09-03
asked-as:
  - screen share shows only the wallpaper again
  - OBS display capture shows desktop picture no windows
  - do I need to toggle the screen recording permission
  - why does the wallpaper bug keep coming back
  - how to fix OBS capturing wallpaper without restarting
---

**When OBS shows the desktop wallpaper with no windows, the ScreenCaptureKit
stream inside OBS has died. Rebuild the stream. The Screen Recording grant is
not the cause, and the permission toggle only ever worked because it made
Ryan relaunch OBS.**

Measured 2026-09-03. OBS had run since 17:41 the previous day and had been
verified clean at 17:50 (Screen L 4.2 against the OS's own capture). In the
morning: 81 and 75, wallpaper only. Checked and ruled out:

| candidate | evidence | verdict |
|---|---|---|
| stale grant after an OBS update | same OBS process, no update | no |
| macOS periodic re-approval | `ScreenCaptureApprovals.plist`: OBS next reminder 2026-11-02, policy 90 days | no |
| re-applying identical source settings | still 81 | no-op in OBS |
| pointing each source at the other display and back | 3.3 / 13.4, clean | **yes** |

Mechanism: a screen_capture source keeps an SCK stream; across the night's
sleep/wake cycles the stream stops delivering window content and falls back to
the desktop picture, and OBS never recreates it because its settings did not
change. Changing `display_uuid` forces a new stream.

How to apply: `obs/heal-screens.mjs` by hand; the plugin does it on every
OBS connect and every system wake (`plugin/src/screen-heal.ts`). Run
`obs/check-screens.mjs` to prove it. The README's "toggle the grant" row is
corrected to point here; the toggle stays as the fallback if a rebuild does
not recover.

Related: [[screen-capture-renders-only-while-active]].
