## OUTCOME

> Final product decision: previews use the official seekable `@hyperframes/player`
> against main-process-compiled `srcdoc`. Rendered artifacts remain fallback/delivery;
> popout transport stays synchronized through BroadcastChannel.

# MIG-011: Preview off the legacy Player, onto the indii player interface

Type: AFK after architecture sign-off · Blocked by: MIG-006, MIG-008 · Stories: 3

> STATUS: **live Player implemented.** Main and popout compile the active project to
> same-origin HyperFrames `srcdoc`. Completed artifacts remain the delivery/browser
> fallback and are invalidated by project edits.

## Parent
docs/video/remotion-migration/PRD.md

## What to build
Route editor preview (main stage + popout) through the indii-owned player interface backed by
the new engine for ported compositions. Playback controls (play/pause/seek/frame-step),
waveform visualization, and popout behavior feel identical to users. WYSIWYG guarantee:
preview matches golden outputs.

## Acceptance criteria
- [x] Main stage + popout play and seek the active project before a render
- [x] Both surfaces use the official browser-safe `@hyperframes/player@0.8.11`
- [x] Artifact URL synchronizes over BroadcastChannel and clears on project edits
- [x] Empty state is explicit when the project has no clips
- [x] Audio waveform no longer depends on engine media utilities
- [x] Timeline scrubbing drives the seekable Player and Player time updates drive the playhead
