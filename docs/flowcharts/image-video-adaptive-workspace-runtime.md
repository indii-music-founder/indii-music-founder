# Image and Video Adaptive Workspace Runtime

**Date:** 2026-07-28
**Scope:** Creative Studio, Video Director, Storyboard, Scene Builder, Editor,
and the existing node workspace.

## Runtime flow

```mermaid
flowchart LR
    Window["Window / Electron content bounds"] --> Shell["Global application shell"]
    Sidebar["Global sidebar state"] --> Shell
    Chat["Global chat / right-panel width"] --> Shell
    Shell --> Observer["Module ResizeObserver"]
    Observer --> Budget["Shared workspace width budget"]

    Budget --> Wide["Wide mode"]
    Budget --> Standard["Standard mode"]
    Budget --> Focused["Focused mode"]

    Wide --> WideLayout["Navigation + primary canvas/stage + contextual rail"]
    Standard --> StandardLayout["One persistent rail + primary canvas/stage + one drawer"]
    Focused --> FocusedLayout["Primary canvas/stage + accessible drawers"]

    StudioControls["Studio controls"]
    History["History / Brand / Builder"]
    Dailies["Dailies / shot inspector"]
    Settings["Generation / render settings"]

    StudioControls --> Budget
    History --> Budget
    Dailies --> Budget
    Settings --> Budget

    WideLayout --> Context["Preserved creative context"]
    StandardLayout --> Context
    FocusedLayout --> Context

    Context --> Selection["Selection and asset identity"]
    Context --> ViewState["Zoom, pan, playhead, timeline range"]
    Context --> DraftState["Prompt, settings, unsaved edits"]
    Context --> JobState["Reservation, job progress, errors, retry identity"]

    Master["Verified artist master"] --> Video["Video project"]
    AudioDNA["Owner-scoped Audio DNA receipt"] --> Video
    Context --> Video
    Video --> Admission["Backend admission and quote"]
    Admission --> Vertex["Backend-only Vertex generation"]
    Vertex --> Receipt["Durable job and asset receipt"]
    Receipt --> Dailies
    Receipt --> Timeline["Master-relative timeline"]
    Timeline --> Render["Owner-approved render"]
    Render --> Marketing["Lineage-preserving marketing derivatives"]
```

## Layout invariants

1. The module observes its **actual container width**; viewport breakpoints are
   not the authority for internal pane layout.
2. The primary canvas, stage, or timeline keeps a useful minimum width.
   Lower-priority rails collapse into drawers before the primary work surface is
   crushed or covered.
3. Persisted panel preferences are clamped while space is constrained and may
   be restored when space returns.
4. Mode changes never reset the selected asset, canvas transform, playhead,
   prompt, generation settings, operation identity, progress, or unsaved work.
5. Drawers provide a visible trigger, backdrop where appropriate, Escape
   handling, focus containment, and focus return.
6. Pane separators expose accessible values and remain usable at 200% zoom.
7. Generated or native video sound is subordinate to the artist's verified
   master. Auxiliary voiceover or effects remain separate, labeled sources.

## Delivery order

```mermaid
flowchart TD
    P0["P0: single-claim video security and verified inputs"] --> P1A["P1: shared container-aware workspace"]
    P1A --> P1B["P1: canonical creative asset lifecycle"]
    P1B --> P1C["P1: admission, quote, 400/429 recovery"]
    P1C --> P2A["P2: image workspace handoffs and history"]
    P1C --> P2B["P2: music-first Video Director and Dailies"]
    P2A --> Nodes["Existing node system productization"]
    P2B --> Nodes
    Nodes --> Eval["Music-specific evaluation and real-user validation"]
```

## Verification

- Widths: 2560, 1920, 1440, 1280, 1024, and 768 CSS pixels.
- Zoom: 80%, 100%, 125%, 150%, and 200%.
- Global sidebar and right panel: each open, closed, resized, and restored.
- Internal rails: each open, closed, converted to a drawer, and returned.
- Content states: empty, loading, completed image, playing video, long error,
  approval required, and recoverable 400/429.
- Platforms: browser, Electron maximize/restore/manual resize, and supported
  secondary-window surfaces.
- Assertions: no body-level horizontal scroll, hidden primary action,
  unannounced overlay, undersized primary work surface, or creative-context
  reset.
