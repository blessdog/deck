#!/bin/zsh
# FINISH-DECK — the whole loop, in order, with verification. Double-click or run.
#   1. build the plugin        2. write the layout onto the decks (quits + relaunches the Stream Deck app)
#   3. tripwire the deck        4. restart the plugin
#   5. prove OBS: screens see real windows, cutout cuts, float is a card
# Stream Deck app: quit by the profile writer. OBS: must be running for step 5 (it cold-starts if not).
set -e
cd "$(dirname "$0")"
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
echo "== 1-4. build → layout → tripwire → restart"
npm run --silent deck
echo "== 5. prove OBS"
pgrep -x OBS >/dev/null || node obs/cold-start.mjs
node obs/check-screens.mjs
node obs/check-cutout.mjs evidence/cutout-check.png
node obs/check-float.mjs
echo "✓ FINISH-DECK: everything the machine can prove is green. The rest is a press."
