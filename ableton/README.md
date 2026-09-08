# ableton/ — SP-404 and music controls

The deck bindings for Ableton and the SP-404 belong here. Work was resumed by
Ryan on September 8; the [performance plan](../docs/DECK-PERFORMANCE-2026-09-08.md)
specifies the sequence and hardware tests. No MIDI deck triggers ship yet.

`~/projects/mediaStudio/ABLETON/` owns music preparation and the SP sample
library. Reuse that owner; this section maps selected sounds to deck cues.

The connected device is an SP-404MKII. OBS already captures its USB audio, and
the SD+ SP-404 dial controls the recorded level. Before sending MIDI, measure
the active mode, offsets and a safe occupied pad. The sibling `phase8_sp404`
ledger's ascending pad-note arithmetic disagrees with Roland's physical row
order; see the source-linked mapping in the report before reusing it.
