#!/bin/bash
# Double-click me. Finishes the Stream Deck build: registers the zoom-to-cursor
# script with OBS, retires the dead Companion plugin, and applies the deck
# layout. Quits and relaunches OBS and the Stream Deck app itself, because both
# rewrite their config on exit and edits made underneath them are discarded.
set -u
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
cd "$(dirname "$0")"
SD="$HOME/Library/Application Support/com.elgato.StreamDeck"

say_step() { printf "\n\033[1;36m== %s\033[0m\n" "$1"; }

say_step "Checking nothing is rolling"
node -e "
import('./scripts/lib/obs.mjs').then(async ({connect}) => {
  try {
    const obs = await connect();
    const r = await obs.call('GetRecordStatus'), s = await obs.call('GetStreamStatus');
    await obs.disconnect();
    if (r.outputActive || s.outputActive) { console.error('OBS is recording or streaming — stop it first.'); process.exit(1); }
    console.log('  not recording, not streaming');
  } catch { console.log('  OBS not reachable (fine)'); }
});" || exit 1

say_step "Quitting OBS"
if ! osascript -e 'tell application "OBS" to quit' 2>/dev/null; then
  echo "  Couldn't quit OBS. Quit it by hand, then re-run."
  exit 1
fi
for i in $(seq 1 40); do pgrep -x OBS >/dev/null || break; sleep 0.5; done
sleep 2

say_step "Registering zoom-to-cursor"
node scripts/install-zoom.mjs || exit 1

say_step "Raising the recording bitrate (13.9 -> 45 Mbps)"
node scripts/set-record-quality.mjs 45000 || exit 1

say_step "Restarting OBS"
open -a OBS --args --collection "Control Room" --scene "Starting Soon"
sleep 22
node scripts/verify-zoom.mjs || echo "  !! not loaded — check OBS > Tools > Scripts > Script Log"

say_step "Quitting the Stream Deck app"
if ! osascript -e 'tell application "Elgato Stream Deck" to quit' 2>/dev/null; then
  echo "  Couldn't quit it. Grant Automation permission, or quit it by hand, then re-run."
  echo "  (NOT force-killing: a killed Stream Deck offers to restore a stale backup"
  echo "   on next launch, and accepting that reverts this layout.)"
  exit 1
fi
for i in $(seq 1 40); do pgrep -f "Elgato Stream Deck.app/Contents/MacOS" >/dev/null || break; sleep 0.5; done
sleep 2

say_step "Retiring the dead Companion plugin"
mkdir -p "$SD/Plugins-retired-2026-08-01"
if [ -d "$SD/Plugins/io.bitfocus.companion-plugin.sdPlugin" ]; then
  mv "$SD/Plugins/io.bitfocus.companion-plugin.sdPlugin" "$SD/Plugins-retired-2026-08-01/" \
    && echo "  moved (reversible)"
else
  echo "  already gone"
fi

say_step "Applying the deck layout"
node scripts/build-profile.mjs || exit 1
open -a "/Applications/Elgato Stream Deck.app"
sleep 14

say_step "Verifying"
node scripts/check-deck.mjs
printf "\n\033[1;32mDone. ZOOM is on row 3, third from the left.\033[0m\n"
printf "Press it while sharing the left monitor: punches in 2x on the cursor.\n"
printf "Long press toggles follow.\n\n"
[ -t 0 ] && read -n 1 -s -r -p "Press any key to close." || true
