# MIG-011 Decision: Live HyperFrames Player Preview

**Status:** Supersedes the temporary artifact-only decision on 2026-08-23.

## Product decision

The editor and popout use `@hyperframes/player` with same-origin `srcdoc` HTML
compiled from the active `IndiiVideoProject`. This restores live play, pause, and
timeline seeking. A completed MP4 remains a browser/failure fallback and a durable
export artifact; users do not have to render before they can see an edit.

This follows HyperFrames' published application contract:

```
IndiiVideoProject → deterministic HyperFrames HTML → Player or render
```

The main process owns compilation and inlines the exact bundled GSAP runtime for
preview. The final local render invokes the same compiler and GSAP asset, then routes
through `RenderPlanner` to FFmpeg or the composition contract. Generated elements carry
stable `data-hf-id` values so the composition is compatible with HyperFrames SDK and
Studio editing surfaces.

## Why the earlier choice was wrong

The original Option B optimized dependency purity over the artist experience. It left
new and edited projects preview-less until a complete render finished. HyperFrames
publishes `@hyperframes/player` specifically as the browser-safe playback layer; it is
not the Node rendering engine. Keeping the Player out of the renderer provided no user
benefit worth losing live scrubbing.

## Studio boundary

`@hyperframes/studio` is not embedded in this change. Its published package requires
React 19 and project-server contexts, while indii currently ships React 18 and owns its
timeline/persistence model. The supported Player is integrated now. A future complete
Studio integration should migrate deliberately to the shared editable HTML/project-file
model rather than mounting disconnected Studio widgets or creating a second source of
truth.

## Acceptance evidence

- active projects compile to Player `srcdoc` without a render;
- timeline transport seeks the Player by seconds derived from project FPS;
- Player `timeupdate` advances the indii playhead;
- the popout compiles the same project and retains BroadcastChannel transport sync;
- an empty project says “Add a clip to preview”;
- a completed artifact remains available when live compilation is unavailable.
