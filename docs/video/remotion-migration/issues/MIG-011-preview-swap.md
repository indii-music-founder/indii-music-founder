## OUTCOME

> Option B EXECUTED during the removal: previews play rendered artifacts through a plain <video> bound to the store (`previewArtifactUrl`), popout synced via BroadcastChannel, empty-state when nothing is rendered. Zero engine code in the renderer bundle.

# MIG-011: Preview off the legacy Player, onto the indii player interface

Type: AFK after architecture sign-off · Blocked by: MIG-006, MIG-008 · Stories: 3

> STATUS: **Option B implemented.** Local and cloud completion paths populate
> `previewArtifactUrl`; project edits invalidate it. Main and popout use a plain video
> element. Live timeline scrubbing is intentionally absent.

## Parent
docs/video/remotion-migration/PRD.md

## What to build
Route editor preview (main stage + popout) through the indii-owned player interface backed by
the new engine for ported compositions. Playback controls (play/pause/seek/frame-step),
waveform visualization, and popout behavior feel identical to users. WYSIWYG guarantee:
preview matches golden outputs.

## Acceptance criteria
- [x] Main stage + popout play the current completed artifact
- [x] Artifact URL synchronizes over BroadcastChannel and clears on project edits
- [x] Empty state is explicit when no current artifact exists
- [x] Audio waveform no longer depends on engine media utilities
- [ ] Live/frame-accurate timeline scrubbing (explicitly deferred by Option B)
