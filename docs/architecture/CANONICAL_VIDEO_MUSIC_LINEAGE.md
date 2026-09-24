# Canonical Video Music Lineage — Phase 7 first delivery

This delivery extends the existing storyboard and render-project path. When a
storyboard is created from an ingested track, it carries the intake's internal
`recordingEntityId` into the existing canonical-master render reference and
marks the soundtrack use as `USES_FULL_RECORDING`. Compilation preserves that
lineage and rejects disagreement between the storyboard and its canonical
master reference.

The fields are optional for compatibility with existing saved storyboard and
video-project data. External IDs such as ISRCs and platform video IDs are not
accepted as recording identity. The reference remains a lineage assertion for
the existing render workflow; it does not assert ownership, clearance, an
official-video designation, or platform publication.

Downstream consumer enabled by this slice: the existing private storyboard
render compiler can now carry the canonical recording and music-use semantics
alongside the immutable source master. Platform publication/UGC identity and
canonical `VideoResource` creation remain later Phase 7 work; this slice does
not claim those capabilities are complete.
