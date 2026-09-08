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

## And then the keys came off

Within the hour Ryan said the thing that should have been the first question:
*"i have the sp-404 as the trigger. There's no sense in having a redundant key
that plays on the stream deck."* Then, plainer: *"a1 a2 a3 are a clunkier
version of what the SP does. That's its one job."*

He is right, and the plan had the answer in it all along: the SP's pads are for
"expressive sound performance," the deck is for "coordinated picture-and-sound
cues." I read that as deck-fires-pad. It meant the two instruments each do
their job and meet in OBS. A key that plays a pad is a worse pad.

The three keys are in `archive/sp-pad-keys/` with the reason on top, the law is
in the store in his words, and the measured pad-to-note map stays in the SP-404
repo because it is true about the instrument regardless of what the deck does.
The deck is back to 23 keys and the tripwire is green. What order 2 costs the
deck now is nothing; what it costs Ryan is loading a bank in the Roland app.

## Night: TAKEAWAY and CHAPTER, and the asset that lied to its own checker

Ryan asked what the blocker was. There was none, so order 3 went in without a
question: a lower banner that reads its line from a text file in the Movies
folder, and a chapter key that drops a marker in the recording and wipes a cyan
bar across the shot with a whoosh. Both are overlay scenes nested hidden in the
nine speaking scenes; the key lights the item in whatever scene is on program
and puts it out again in that same scene. Not a stinger transition, because a
chapter break is usually the same shot before and after and OBS cannot
transition a scene to itself.

The first sting asset failed its own check. The mid frame was black and the
alpha fully opaque: ffmpeg's `drawbox` did not re-evaluate its `t` expression
per frame, and VP9's alpha did not survive a probe either way. Rebuilt with
`overlay` (which evaluates per frame) into ProRes 4444, the alpha at frame 10
measured 0.21 opaque, the bar. The command, for the next asset:

```
ffmpeg -f lavfi -i "color=c=black@0.0:s=1920x1080:r=30:d=0.7,format=rgba" \
  -f lavfi -i "color=c=0x22d3ee@0.85:s=420x1080:r=30:d=0.7,format=rgba" \
  -f lavfi -i "color=c=white@0.95:s=48x1080:r=30:d=0.7,format=rgba" \
  -f lavfi -i "anoisesrc=d=0.7:c=white:a=0.6:r=48000" \
  -filter_complex "[0:v][1:v]overlay=x='-480+(1920+960)*t/0.7':y=0:eval=frame:format=rgb[b];\
    [b][2:v]overlay=x='-480+(1920+960)*t/0.7-60':y=0:eval=frame:format=rgb,format=yuva444p10le[v];\
    [3:a]highpass=f=400,lowpass=f=6000,afade=t=in:st=0:d=0.08,afade=t=out:st=0.25:d=0.45,volume=-14dB[a]" \
  -map "[v]" -map "[a]" -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -c:a pcm_s16le chapter-sting.mov
```

Then the second lie, smaller: one screenshot at +330 ms showed no bar, and a
burst of nine showed why — the decoder opens on activate and the first painted
frame arrives around +150 ms. Measured by cyan area per frame, the bar is on
screen from roughly +250 to +830 ms and gone after. One frame is an anecdote;
nine are a measurement.

Four cue keys on the deck now, all waiting for the same thing: his thumb.

## Evening: the thumb came down, and it was a delete

**Tried.** Four cue keys — TAKEAWAY, CHAPTER, NORMAL, LAVA — machine-exercised
and left on the deck for Ryan's press.

**Happened.** He deleted them in the Stream Deck app and said: *"I've deleted
some of the Stream Deck keys that were a waste of space that I didn't like.
Don't add them again."* The tripwire went red on exactly those four as shipped
actions with no key, which is the one shape it could see. What it could not
see was worse: `build-profile.mjs` still carried them in the layout, and one
run would have put all four back.

**Mechanism.** The layout is the SSOT for which action sits on which key, so
when Ryan edits the deck directly the truth runs the other way for a moment,
and nothing in the loop said so. A shipped action with no key looks identical
whether he removed it or nobody placed it yet, so the retirement cannot be
inferred — it has to be declared.

**Verdict — law.** `knowledge/deleted-keys-stay-deleted`. The four are in
`RETIRED` in `deck-layout.mjs`, their code is runnable in `archive/cue-keys/`,
and `check-deck.mjs` now fails on a retired name in `ACTIONS` or on any grid
(proven firing on a re-added LAVA before commit). Layout diffed against the
live XL and SD+ pages: 0 mismatches. He removed keys, not scenes: the overlay
scenes and Lava Lounge stay in OBS.
