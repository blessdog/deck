# From available buttons to recording cues

Writer: deck maintainer. Readers: Ryan and future work on this rig. Failure if
wrong: confusing proposed cues with installed controls or repeating this audit.

Ryan asked to use the Stream Deck more effectively for entertaining recordings,
including transitions, animations and the SP-404 soundboard. The older roadmap
still called Move and the audio dials future work, although both had shipped.
The current research is [here](../DECK-PERFORMANCE-2026-09-08.md).

Reading the actual OBS collection exposed a more immediate gap: Me + Float had
no SP/App Audio items, and Cam Cutout had none of the dedicated audio inputs.
The repair script discovered speaking scenes by finding Mic, so a scene missing
Mic was excluded from its own repair. We added the Cutout case and restored five
shared input placements. A second dry run needed no additional placements.

The recording exercise captured app audio across four looks with four AAC
tracks in the finished MP4. Exact source item IDs and the OBS-returned recording
path are in `evidence/2026-09-08/`. No recordings were deleted. The prior program
scene was restored. Physical SP pad and key checks remain outstanding.

Roland's current MIDI table also exposed an unsafe assumption in the sibling
sample ledger: pad numbers do not map to ascending notes across all four rows.
That owner needs a mode-aware mapping before deck cues reuse it. No samples or
sampler settings were changed here.

The proposed sequence is REACT/NORMAL, the SP recording bank, TAKEAWAY/CHAPTER,
combined cues, and SAVE LAST. The report separates vendor capabilities, local
measurements and proposed behavior so the next session can implement the cues
without mistaking this research for already-installed actions.

## Later the same day: REACT and NORMAL installed

Searched before building: no hold-to-switch in the official Elgato OBS plugin,
none in OBS's own hotkeys, and Advanced Scene Switcher only through a keyboard
hotkey macro. The plugin already sees key-up and owns the key faces, so the cue
went in there: one shared cue store, a momentary REACT key, a NORMAL key that
only lights while something needs undoing. The React scene reuses the shared
Camera at 1.4x so Move slides the shot and the camera ISO keeps rolling.

Two edges were designed in rather than found: a fast tap (key-up before the
capture round-trip returns) awaits the key-down promise, and a scene key pressed
mid-hold drops the cue instead of dragging the program back on release.

The profile write replaced a hand-placed Elgato "Scene Transition" key at 4,1,
which also proved the official OBS action package is installed — the morning's
audit row said it was not. Corrected in the report. Whether that key was in use
is Ryan's to say; putting it back is one drag in the Stream Deck app.

Everything a machine can check is green. Everything that matters is a press.

## The gate that lied in both directions

Running `npm run check` after the rebuild failed on the cutout: transparent
ratio 0.000, Ryan and the room fully opaque, with the filter enabled and the
model right. Minutes later the same inactive screenshot showed a Ryan-shaped
hole over an EMPTY room — a mask from earlier composited on a frame from now.
On program the scene measured 0.999 within a second. The camera keeps
delivering frames when inactive; the segmentation does not run until the
source renders. The check now exercises the scene on program before measuring,
the same fix the screen check got on September 2. Verdict filed as
`knowledge/cutout-mask-is-stale-while-inactive.md`. Not a regression from the
REACT work; a verifier that had been observing instead of exercising.

## Evening: the sampler's note map, measured, and a silence that is not yet explained

Ryan sat at the SP-404 and pressed five pads by name while `receivemidi`
listened. Channel is the bank, and the notes run from the top row down: pad 13
is 36, pad 1 is 48. Roland's own table says only Mode A puts bank B on
channel 2, which is what arrived. The September 7 dead end fell over: note 36
was never a broken path, it was pad 13.

The deck side went in as one action with per-key bank and pad settings, using
`@julusian/midi` in-process after timing the CLI route at ninety milliseconds a
spawn, which a thumb would feel. The native module loads lazily inside a
try/catch, because a `.node` file that fails to resolve must dim three keys,
not kill twenty-six.

Then the honest part. Four notes went out to the unit and its USB audio input
recorded nothing but digital zero, while the mic captured room noise through
the same path a minute later. Roland lists USB OUT as a gain with no mute. So
either the pads we fired hold nothing, or the unit is not listening. The
machine cannot tell those apart; one physical pad press during a capture can.
That is where order 2 stands: keys installed, notes leaving, sound unproven.
