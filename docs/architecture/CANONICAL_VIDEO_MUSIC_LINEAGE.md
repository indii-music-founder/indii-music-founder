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

Downstream consumers enabled by this slice: the existing private storyboard
render compiler carries canonical recording/music-use semantics alongside the
source master, and the existing track library persists the resulting canonical
`VideoResource`, immutable `Asset`, and confirmed music `Relationship`. The
video designation is explicitly selected by the user; it is never inferred
from generated content. The completed private-render receipt supplies the
server-verified stable `gs://` object reference and generation separately from
its expiring signed URL.

The shared contract also reserves namespaced platform identifiers on a
`VideoResource`, but this path creates none: provider ingestion/publication and
UGC matching remain later Phase 7 work and require their own source evidence.
This delivery does not assert ownership, clearance, official status beyond the
user's designation, or a provider-side publication.
