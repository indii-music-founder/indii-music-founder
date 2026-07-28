# Image + Video UX Completion Plan

**Date:** 2026-07-28
**Status:** Implementation authorized; P0 security built locally and awaiting production proof
**Product position:** A music-first visual production system, not a generic model gallery.

### Audio scope boundary

indii does **not** generate songs, replacement masters, backing tracks, or
artist music. The artist's uploaded, verified master recording remains the
authoritative music throughout the product. Audio generation is limited to
clearly auxiliary production material when requested—for example an ad
voiceover or sound effect—and must never be confused with, replace, or alter
ownership of the artist's music. Video controls may preserve, mute, duck, or
blend native/generated video sound around the canonical master, but they do not
create a new song.

## 1. Product North Star

An artist should be able to start with one verified master recording and move
through visual concepting, image generation, storyboarding, video generation,
editing, review, export, and campaign handoff without losing project context,
creative lineage, cost visibility, or the authority of the master track.

The shortest successful route is:

`verified master → Audio DNA → visual concept → reusable people/places/styles → storyboard/shot plan → generated clips → beat-aligned edit → owner-approved master-relative render → marketing derivatives`

The interface should reveal advanced controls when useful, but keep the default
path understandable to an artist who is not a prompt engineer or film editor.

## 2. Existing Foundation to Preserve and Connect

The product already has substantial image/video infrastructure:

- `CreativeStudio`, Direct Generation, Infinite Canvas, Whisk, Showroom,
  Autonomous Lab, PLP batches, history, and brand/character references.
- `VideoWorkflow`, first/last frames, reference images, Dailies, Storyboard,
  Scene Builder, Session Ingestion, and a persistent timeline editor.
- A real node system in `modules/workflow`: typed IMAGE, VIDEO, AUDIO, TEXT, and
  CONTEXT ports; image refine, image-to-video, video extension, song analysis,
  performance clip, and beat-sync assembly nodes; music-video templates.
- Canonical master audio, Audio DNA receipts, owner-scoped generation, and
  backend Vertex AI routing.
- `AdaptiveWorkspace`, `useWorkspaceLayout`, and `getRightPanelLayout` as the
  beginnings of container-aware layout behavior.

The plan must tune and connect these systems. It must not replace the node
system with a new graph framework or create another parallel media library.

## 3. Competitive Baseline

### What users will expect

- **Magica:** one conversational agent plus direct “Nodes,” broad image/video
  model access, text/image/video-to-video modes, prompt enhancement, progress,
  batch history, and fast preset discovery.
- **Google Flow:** not a central product competitor, but an important
  implementation-quality benchmark because it orchestrates the same Google AI
  model family exceptionally well. Study how it exposes capabilities and model
  constraints, manages references and reusable assets, moves between image and
  video operations, tracks long-running jobs, preserves history, communicates
  credit use, and turns provider results into fluid next actions. Useful visual
  reference points include Ingredients, image animation, scene extension,
  camera control, collections, and Scene Builder. indii should reach that level
  of API orchestration without imitating Flow's broader product positioning.
- **Adobe Firefly:** connected generation and editing, project persistence,
  reusable Elements, first/last keyframes, history, Timeline, Boards, Graph,
  and direct handoff from generation into editing.
- **Runway:** reusable character/location references and a filmmaking vocabulary
  built around casting, locations, blocking, shots, and consistency.

### indii’s required separation

indii should match the baseline for generation history, references, scene
continuity, camera controls, and generation-to-editor handoff, then exceed it
with:

- master-recording authority and preserved audio lineage;
- Audio DNA-driven visual direction;
- beat, bar, section, drop, and lyric alignment;
- music-video continuity across wardrobe, artist likeness, props, locations,
  lighting, and performance energy;
- rights, release, royalty, marketing, and distribution handoffs;
- reusable music-business workflows expressed as existing typed nodes;
- truthful cost, job, approval, and deliverable receipts.

This differentiation is not music generation. It is the ability to let one
artist-owned master recording flow safely through visual creation, editing,
promotion, rights, and financial systems.

## 4. Priority 0 — Secure and Truthful Generation

These are release blockers, not UX polish.

1. Finish ISSUE-1246/1247 production validation:
   - exactly one paid worker per video job;
   - one immutable reservation-to-job mapping;
   - owner/bucket/generation/byte verification for every media input;
   - conservative settlement for ambiguous provider outcomes.
2. Finish ISSUE-1235, 1224, 1225, 1228, and 1244:
   - all paid AI work is backend-only on Vertex;
   - no provider credentials or provider authority in renderer code;
   - verified email, App Check where applicable, Arcjet, entitlement, rate,
     concurrency, and budget admission precede cost-bearing work.
3. Standardize 400/429 behavior:
   - classify invalid input, unsupported combinations, quota exhaustion,
     provider throttling, concurrency limits, and temporary unavailability;
   - show a repair action and safe retry time;
   - preserve the operation/idempotency key;
   - never turn a rejected/queued/unknown result into visual success.
4. Require durable terminal evidence before an image/video is counted, added to
   a campaign, exported, or presented as completed.
5. Treat Google's own products as the reference implementation for Google API
   ergonomics:
   - derive available controls from the selected model capability contract;
   - prevent incompatible combinations before submission;
   - preserve provider operation identity through polling and retry;
   - show normalized output settings and credit effects before generation;
   - turn each verified result into an immediate, typed next action;
   - retain history and project context across model/API transitions.

## 5. Priority 1 — Container-Aware Workspace and Pane System

### Current gap

The global chat width has a viewport budget and `AdaptiveWorkspace` observes its
own container, but Creative Studio and Video Workflow still rely heavily on
viewport breakpoints, fixed percentages, fixed padding, and absolute overlays.
They do not consume `AdaptiveWorkspace`. Opening/resizing the global sidebar,
chat panel, Studio Controls, history, Dailies, or technical settings can leave
the central canvas/stage cramped or covered.

### Plan

1. Adopt one shared workspace contract for Creative Studio, Direct Generation,
   Video Director, Storyboard, Scene Builder, and Editor.
2. Observe the actual remaining module width with `ResizeObserver`; never infer
   space solely from `window.innerWidth`.
3. Define three modes:
   - **Wide:** persistent navigation/controls + central work + contextual rail.
   - **Standard:** one persistent rail; the other becomes a drawer.
   - **Focused:** central canvas/stage only; all adjacent tools become accessible
     drawers/sheets with visible triggers.
4. Establish a pane budget:
   - protect a useful central canvas/stage minimum;
   - cap adjacent panels before crushing the center;
   - clamp persisted panel widths whenever the window shrinks;
   - restore preferred widths when space returns;
   - resolve simultaneous resize events without oscillation.
5. Make the relationships explicit:
   - resizing the window recomputes every adjacent pane;
   - resizing the global chat changes module mode;
   - expanding Studio Controls can collapse a lower-priority rail;
   - opening History/Brand/Builder never overlays the primary action without a
     drawer/backdrop/focus contract.
6. Preserve creative context when mode changes: selection, zoom, playhead,
   prompt, job progress, expanded section, and unsaved edits must not reset.
7. Add keyboard and accessibility behavior: Escape closes the top drawer,
   focus returns to its trigger, pane separators expose ARIA values, and 200%
   zoom remains operable.

### Verification matrix

- Viewports: 2560, 1920, 1440, 1280, 1024, and 768 CSS pixels.
- Global sidebar: open/collapsed.
- Global right panel: closed, 320 px, preferred width, maximum width.
- Studio rail: open/collapsed.
- Content: empty, loading, generated image, playing video, long error text.
- Zoom: 80%, 100%, 125%, 150%, 200%.
- Electron maximize, restore, manual resize, and secondary/popout window.
- Invariants: no horizontal body scroll, no hidden primary action, no pane
  smaller than its minimum, no canvas/stage under an unannounced overlay.

## 6. Priority 1 — One Creative Project and Asset Lifecycle

1. Use one project-scoped media record for uploaded, generated, staged,
   approved, rejected, and exported assets.
2. Make status visible and precise:
   `uploading → verified → queued → processing → completed/failed/cancelled →
   approved → rendered`.
3. Keep generation history, project assets, Infinite Canvas, Storyboard,
   Dailies, Timeline, Showroom, PLP, and node outputs on the same immutable asset
   identity and lineage.
4. Never use an empty URL as a queued token. UI records need typed lifecycle
   state; playable URLs appear only with terminal evidence.
5. Give every job a persistent inspector with:
   - operation/job ID;
   - model/tier chosen by the backend;
   - normalized duration/resolution/aspect ratio;
   - estimated and settled credits;
   - input roles and lineage;
   - progress, retry state, and actionable failure;
   - resulting asset/render receipt.
6. Preserve partial batch successes and retry only failed slots with the
   original idempotency context.

## 7. Priority 1 — Generation Admission and Cost UX

1. Show the backend quote before Generate:
   - normalized model, duration, resolution, output count;
   - credit cost and remaining balance;
   - which controls raise cost;
   - whether a top-up is sufficient to finish the current task.
2. Entitlements:
   - **Free verified users:** a small lifetime/onboarding sample allocation,
     strict concurrency and daily limits, no disposable-email cycling.
   - **Founders (including `wiil`):** full product access under a documented
     high fair-use ceiling and abuse protection—not a client-side unlimited flag.
   - **Annual software / BYO API:** supported later only through a secure
     backend-bound Google Cloud/Vertex billing connection. No API key is ever
     stored in or sent to the browser.
   - **Top-ups:** small credit packs available to any verified tier, including
     free users, so a creator can finish a project without a subscription.
3. Use credits/work units instead of “minutes per month.” A planning action,
   image variation, 4K video, analysis, upscale, and render have different cost
   profiles and should debit different server-owned units.
4. Make 429 recoverable: retain the prepared job, explain whether the limit is
   user, tier, concurrency, provider, or project quota, and offer retry/top-up
   only when that action can actually resolve it.

## 8. Priority 2 — Image Workspace Tune-Up

1. Unify Generate, Canvas, Showroom, Keyframes, Whisk, and History around a
   persistent project context rather than feeling like separate mini-apps.
2. Upgrade the result surface:
   - deterministic variation slots;
   - compare/select/reject/favorite;
   - before/after and version lineage;
   - retry failed variations only;
   - “use as first frame,” “use as last frame,” “send to storyboard,” “add to
     node,” and “prepare cover art” as typed handoffs.
3. Finish Infinite Canvas safety gaps:
   - await every layer before flatten;
   - preserve undo/version evidence;
   - never discard paid sibling outputs after partial failure.
4. Make image input roles visible: subject, scene, style, character, product,
   first frame, last frame, mask. Detect bytes/MIME/dimensions; never rely on a
   caller label.
5. Surface distributor/marketing format profiles without claiming compliance
   until the persisted output bytes have been measured.
6. Add non-destructive crop/fit previews for each downstream aspect ratio.

## 9. Priority 2 — Music-First Video Director

1. Default the Director to the verified master:
   - waveform, bars/beats, sections, energy arc, key lyrics/moments;
   - master hash/generation and Audio DNA receipt visible in the project
     inspector;
   - explicit “master dominant / blend native / mute native” policy.
2. Turn the current controls into a shot workflow:
   - concept → references → shot card → first/last frame → camera/motion →
     duration/cost → generate → Dailies → approve → Timeline.
3. Make model constraints contextual. Disable or explain conflicting controls
   (for example, first+last frame versus camera-motion options) before submit.
4. Keep artist/wardrobe/location/prop/style continuity in reusable project
   entities, not repeated free-text prompts.
5. Storyboard and daisychain:
   - preserve individual shot boundaries and timing;
   - show normalized segment duration;
   - chain approved terminal frames;
   - expose failed segment retry without regenerating successful segments.
6. Dailies:
   - side-by-side takes with prompt/settings/cost;
   - approve/reject annotations;
   - first terminal event is immutable;
   - approved take drops into the correct master-relative timeline range.
7. Timeline/render:
   - source-range, proxy, and master-audio lineage;
   - beat snapping and section markers;
   - generated/native/master audio mixer, with the artist master authoritative
     and auxiliary sound or ad voiceover clearly separated;
   - render progress and durable receipt;
   - owner-only playable artifact before export/marketing handoff.

## 10. Priority 2 — Existing Node System Productization

Do not build another node system. Productize `NODE_REGISTRY`,
`WorkflowEngine`, `workflowTemplates`, and the existing Workflow Lab.

1. Replace URL/string-shaped media outputs with canonical asset references and
   durable job/receipt types.
2. Make typed ports enforce role and lineage, not only broad IMAGE/VIDEO/AUDIO:
   canonical master, Audio DNA, first frame, character, style, shot plan,
   approved take, timeline, and render receipt.
3. Show node execution truth:
   waiting, admitted, queued, processing, approval required, completed, failed,
   cancelled, and blocked.
4. Add per-node cost preview, idempotency, retry, and evidence inspector.
5. Ship music-specific starter graphs:
   - master → Audio DNA → visual world → storyboard;
   - master + artist reference → performance clips → beat-sync assembly;
   - cover art → Spotify Canvas/social loops;
   - approved master video → aspect-ratio derivatives → campaign draft.
6. Improve graph UX: minimap, zoom-to-selection, auto-layout, connection
   validation, searchable nodes, collapsible inspector, keyboard creation, and
   container-aware resizing.
7. Version templates and preserve a run snapshot so later node/model changes do
   not reinterpret prior results.

## 11. Priority 3 — Evaluation and Differentiation

Every release candidate should be scored on music-specific outcomes, not only
generic visual appeal:

- beat/bar/section/drop alignment;
- lyric and emotional-moment alignment;
- artist likeness and character continuity;
- wardrobe, prop, location, lighting, and color continuity;
- camera intention and motion coherence;
- first/last-frame adherence;
- lip/performance synchronization where applicable;
- master-audio preservation and native-audio mix correctness;
- shot-to-shot narrative coherence;
- requested versus delivered duration/resolution/aspect ratio;
- retry/idempotency and cost correctness;
- final render playability and owner-only access;
- usable marketing derivatives with asset lineage.

Maintain a small consented internal benchmark set with a versioned rubric and
blind side-by-side reviews. Competitor output can inform the rubric, but the
scorecard must reward indii’s music, business, and provenance advantages.

## 12. Recommended Delivery Order

1. Complete and production-prove P0 generation security and 400/429 handling.
2. Adopt the container-aware workspace contract in Creative Studio and Video
   Director; add the resize/zoom matrix.
3. Unify project asset/job lifecycle and the job inspector.
4. Add server quote/credit/top-up UX.
5. Tune image results, typed handoffs, and Infinite Canvas safety.
6. Tune the song-first Director, Dailies, Storyboard, and timeline/render flow.
7. Productize the existing nodes on the shared asset/job contracts.
8. Add benchmark harness, competitor comparisons, and launch evidence.

Each phase must finish with unit/component tests, visual regression at the
layout matrix, keyboard/accessibility checks, genuine authenticated browser
validation, and production logs/receipts for paid operations. Mock-backed tests
are structural evidence only.

## 13. Primary Affected Areas

- `packages/renderer/src/modules/creative/**`
- `packages/renderer/src/modules/creative/video/**`
- `packages/renderer/src/modules/workflow/**`
- `packages/renderer/src/core/components/RightPanel.tsx`
- `packages/renderer/src/components/layout/AdaptiveWorkspace.tsx`
- `packages/renderer/src/hooks/useWorkspaceLayout.ts`
- `packages/renderer/src/core/layout/workspaceWidthBudget.ts`
- `packages/renderer/src/services/image/**`
- `packages/renderer/src/services/video/**`
- `packages/firebase/src/functions/creative/**`
- `packages/firebase/src/functions/billing/**`
- shared media/job/timeline/receipt schemas
- Firestore and Storage Rules plus emulator/live validation

## 14. Key Risks

- A cosmetic responsive pass can hide controls without preserving access or
  state. Container mode must be a tested product contract.
- Adding more entry points can deepen duplication. Every surface must use the
  same project, asset, job, admission, and receipt services.
- “Unlimited” can become an abuse/cost vulnerability if encoded in the client.
- BYO API can violate the backend-only rule unless implemented as a secured
  server connection with no browser credential exposure.
- Generation history is not proof of a usable asset. Only verified terminal
  receipts should unlock editing, export, or campaign spend.
- Model capabilities and prices change. Backend catalogs must be versioned and
  UI labels derived from server contracts rather than hard-coded assumptions.
