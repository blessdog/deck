#!/bin/zsh
# Runs the OBS cold start; the Stream Deck 🚀 key points at "OBS Cold Start.app" which calls this.
cd "$(dirname "$0")"
/opt/homebrew/bin/node scripts/cold-start.mjs "$@" >> logs/cold-start.log 2>&1
