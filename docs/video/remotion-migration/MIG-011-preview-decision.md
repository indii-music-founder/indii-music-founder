# MIG-011 Decision Doc: Preview Architecture After the Port

> The one slice that cannot be auto-decided: it changes what ships in the browser bundle.

## The tension

`HyperFramesAdapter` lives worker-side (packages/main) by design — browser bundles never
carry the engine. But preview is a renderer-process concern. Three ways through:

## Options

### A. `@hyperframes/player` web component in the renderer bundle
- **Pro:** true WYSIWYG scrubbing, same seekable-timeline semantics as renders.
- **Con:** re-introduces engine code into the browser bundle — the dependency-surface
  we just cleaned. Package is Apache-2.0 so licensing is fine; it's an architecture
  call, not a legal one.

### B. Preview = rendered artifact playback (plain video element)
- **Pro:** zero engine code in renderer; reuses the existing playback layer; preview
  is *literally* the render (perfect WYSIWYG, just not instant).
- **Con:** no live scrubbing while editing; render-on-change latency (mitigate with
  debounced low-res local renders via ElectronRenderService path).

### C. Hybrid: thumbnail/snapshot strip for scrubbing + B for playback
- **Pro:** fast scrub via pre-rendered frame samples (harness already produces these);
  full-fidelity playback on demand.
- **Con:** most code; two preview modes to maintain.

## Recommendation

**B now, C later.** B uses the browser's native video element; it keeps the
bundle clean and the preview honest. If editors demand live scrubbing, C's frame
strips are already half-built by the parity sampler. A remains available — the
contract doesn't change, only the preview surface.

## Acceptance criteria impact

MIG-011's acceptance criteria are revised under B: main stage + popout play completed
artifacts, the artifact synchronizes across windows, and an edited/unrendered project
shows an honest empty state. Frame-accurate live timeline scrubbing is deferred.
