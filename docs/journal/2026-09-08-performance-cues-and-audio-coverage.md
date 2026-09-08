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
