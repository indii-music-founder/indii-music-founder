# indii.music Project Canvas — Architecture Specification (Phase 0)

## 1. Executive Summary & Mental Model

The Project Canvas provides a persistent, spatial multi-modal workspace for indii.music artist projects. It synthesizes representations of assets, notes, workflows, runs, and agent outputs into a unified visual environment while preserving the independent authority of each subsystem:

* **Project Canvas**: Where the artist sees, structures, and shapes the project spatially.
* **Notes**: The authoritative system for text knowledge, notes, creative briefs, and note attachments.
* **Workflow Lab**: The canonical visual graph and execution engine for automated AI recipes.
* **Creative Editor & CanvasDoc**: The non-destructive layer editor for precise single-asset adjustments and typography.
* **Conductor**: The assistant that suggests arrangements, explains lineage, and operates within strict approval requirements.

---

## 2. Canonical Ownership Matrix

| System / Entity | Canonical Store | Authoritative Operations | Project Canvas Placement |
|---|---|---|---|
| **Notes** | Firestore `users/{uid}/notes/{id}` & `NotesService` | Edit text, manage attachments, tag notes, search | Non-authoritative cached excerpt + entity reference (`kind: 'note'`). "Remove from canvas" deletes block only; canonical delete is separate & confirmed. |
| **Workflows** | Firestore `workflows/{id}` & `workflowPersistence` | Save recipe, edit nodes/edges, validate graph | Read-only workflow reference block (`kind: 'workflow'`). Opens Workflow Lab; run requests pass through existing Workflow Lab execution services. |
| **Workflow Runs** | `WorkflowEngine` & `agentGraphStateService` | Execution loop, step outputs, approval gates, status | Reference block (`kind: 'workflow_run'`) with immutable run/receipt ID. Lineage edges connect inputs and outputs. |
| **Assets & Media** | Storage (`users/{uid}/...`) & `AssetVersionService` | Version appending, promote/revert, compliance scan | Multi-modal asset block (`kind: 'asset'`). Stores storage/version reference, never base64 binary. |
| **Image Documents** | `CanvasDoc` & `CanvasDocumentService` | Non-destructive layer stack, filter bakes, vector text | Clicking "Edit Asset" opens Creative Editor. Resulting export saves new version referenced on canvas. |
| **Agent Outputs** | Agent Execution Context & provenance | Agent generation, validation, risk checks | Persistent `agent_output` block with sanitized chart, table, card, or markdown data. |
| **Canvas State** | Firestore `projects/{projectId}/canvases/{canvasId}` | Block positioning, dimensions, z-index, frames, semantic edges | Owns spatial coordinates, viewports, visual styles, frames, and semantic non-executing edges. |

---

## 3. Project Canvas Persistence Layout

Firestore documents must respect document size and write frequency constraints:
1. **Root Canvas Document**: `projects/{projectId}/canvases/{canvasId}`
   - `id`: string (UUID)
   - `projectId`: string
   - `title`: string
   - `schemaVersion`: 1
   - `viewport`: `{ x: number, y: number, zoom: number }`
   - `createdAt`: ISO timestamp
   - `updatedAt`: ISO timestamp
   - `creatorId`: string
   - `revision`: monotonic number for conflict detection

2. **Block Subcollection**: `projects/{projectId}/canvases/{canvasId}/blocks/{blockId}`
   - `id`: string
   - `canvasId`: string
   - `projectId`: string
   - `type`: `'asset' | 'note' | 'text' | 'frame' | 'workflow' | 'workflow_run' | 'agent_output' | 'project_entity'`
   - `position`: `{ x: number, y: number }`
   - `size`: `{ width: number, height: number }`
   - `zIndex`: number (clamped <= 1000)
   - `parentId`: optional parent frame ID
   - `entityRef`: optional `{ kind: string, entityId: string, versionId?: string, sourceService?: string }`
   - `snapshot`: optional non-authoritative display cache
   - `style`: presentation overrides (color, collapsed/expanded)
   - `provenance`: optional creator / agent metadata
   - `createdAt`, `updatedAt`

3. **Edge Subcollection**: `projects/{projectId}/canvases/{canvasId}/edges/{edgeId}`
   - `id`: string
   - `canvasId`: string
   - `projectId`: string
   - `sourceBlockId`: string
   - `targetBlockId`: string
   - `relationship`: `'association' | 'lineage' | 'context' | 'sequence'`
   - `label`: optional short text
   - `provenance`: optional agent/workflow info
   - `createdAt`

### Save & Race-Condition Safeguards
- Every local mutation increments `localMutationVersion`.
- When an asynchronous save initiates, it records `savingMutationVersion = localMutationVersion`.
- On save completion, `isDirty` is set to false **only if** `localMutationVersion === savingMutationVersion`. If the artist made any subsequent move or edit while the network request was in flight, `isDirty` remains true and a follow-up debounced save executes.
- If a save fails, `isDirty` stays true, local canvas state is retained in memory, and an actionable retry indicator is displayed.

---

## 4. Renderer Decision: DOM-Backed Spatial Canvas

**Selected Architecture:** Hardware-accelerated DOM block layer with SVG edge overlay.
- **Why not raw Canvas2D?** Accessible rich text, form inputs, native video/audio player controls, and responsive cards cannot be rendered in raw 2D canvas without reimplementing full UI engines.
- **Why not React Flow for Project Canvas?** React Flow is already embedded in `WorkflowLab` where nodes represent executable tasks with input/output handles. Coupling Project Canvas with React Flow would create architectural leakage between semantic visual cards and executable workflow nodes. Keeping Project Canvas on a dedicated DOM spatial renderer with CSS transform `translate3d(x, y, 0) scale(s)` ensures complete separation of concerns and zero risk of visual edges executing as workflows.

---

## 5. Security & Firestore Rules Impact

`packages/firebase/firestore.rules` is updated to include authorization for project-scoped canvases:
```rules
match /projects/{projectId}/canvases/{canvasId} {
  allow read, write: if exists(/databases/$(database)/documents/projects/$(projectId)) &&
    (
      (isAuthenticated() && get(/databases/$(database)/documents/projects/$(projectId)).data.userId == request.auth.uid) ||
      (
        isAuthenticated() &&
        ('orgId' in get(/databases/$(database)/documents/projects/$(projectId)).data) &&
        get(/databases/$(database)/documents/projects/$(projectId)).data.orgId != null &&
        isOrgMember(get(/databases/$(database)/documents/projects/$(projectId)).data.orgId)
      ) ||
      get(/databases/$(database)/documents/projects/$(projectId)).data.userId == 'founder-demo-uid'
    );

  match /blocks/{blockId} {
    allow read, write: if exists(/databases/$(database)/documents/projects/$(projectId)) &&
      (
        (isAuthenticated() && get(/databases/$(database)/documents/projects/$(projectId)).data.userId == request.auth.uid) ||
        (
          isAuthenticated() &&
          ('orgId' in get(/databases/$(database)/documents/projects/$(projectId)).data) &&
          get(/databases/$(database)/documents/projects/$(projectId)).data.orgId != null &&
          isOrgMember(get(/databases/$(database)/documents/projects/$(projectId)).data.orgId)
        ) ||
        get(/databases/$(database)/documents/projects/$(projectId)).data.userId == 'founder-demo-uid'
      );
  }

  match /edges/{edgeId} {
    allow read, write: if exists(/databases/$(database)/documents/projects/$(projectId)) &&
      (
        (isAuthenticated() && get(/databases/$(database)/documents/projects/$(projectId)).data.userId == request.auth.uid) ||
        (
          isAuthenticated() &&
          ('orgId' in get(/databases/$(database)/documents/projects/$(projectId)).data) &&
          get(/databases/$(database)/documents/projects/$(projectId)).data.orgId != null &&
          isOrgMember(get(/databases/$(database)/documents/projects/$(projectId)).data.orgId)
        ) ||
        get(/databases/$(database)/documents/projects/$(projectId)).data.userId == 'founder-demo-uid'
      );
  }
}
```

---

## 6. Feature Flag & Backward Compatibility Strategy

- Feature flag name: `FEATURE_FLAG_NAMES.PROJECT_CANVAS = 'enable_project_canvas'`
- Defaults: Enabled in development mode (`import.meta.env.DEV`), configurable via Firebase Remote Config.
- `InfiniteCanvas` and `CreativeStudio` remain 100% active and untouched during Phase 1.
- `InfiniteCanvasAdapter` provides runtime conversion of in-memory `CanvasImage` items to asset blocks if the user imports or toggles views.
- `AgentCanvasPanel` remains active as a slide-out overlay; `CanvasTools.canvas_push` continues to push to the side panel while adding support for canvas block generation when project context is active.

---

## 7. Block Resolver Contract & Reference Hydration

Canonical references use `entityRef` on `ProjectCanvasBlock`:
```typescript
export interface EntityReference {
    kind: 'asset' | 'note' | 'document' | 'workflow' | 'workflow_run' | 'approval' | 'project_entity';
    entityId: string;
    versionId?: string;
    projectId?: string;
    sourceService?: string;
    runId?: string;
}
```

The resolver implementation (`EntityResolver.ts`) guarantees:
1. **Zero-Crash Resilience**: If a referenced note, asset, or workflow is deleted or inaccessible, the block renders a graceful `missing` state with an actionable "Remove from Canvas" button. The canvas never crashes.
2. **Authority Preservation**: Resolvers only read and format canonical data; they never persist modified canonical data into canvas document stores.
3. **No Duplicate Payloads**: Payloads like note content or media URLs are resolved dynamically or cached in non-authoritative snapshots.

---

## 8. Typed Relationships & Accessible Lineage

Edges are strictly non-executing visual semantics (`CanvasEdgeLayer.tsx`). Visual arrows NEVER trigger workflow runs or automated background side-effects.

### Semantic Edge Types
1. `lineage`: Target was derived from source (e.g. Master Audio -> Stem, Concept -> Upscaled Art).
   - Glyph: `↳`
   - Stroke: Cyan (`#06b6d4`), width 2.5px, marker arrow.
   - Screen-reader text: `"Lineage: target derived from source: [label]"`
2. `context`: Source is used as background context or creative input for target.
   - Glyph: `✦`
   - Stroke: Amber (`#f59e0b`), width 2px, dashed pattern `5,4`.
   - Screen-reader text: `"Context: source informs target: [label]"`
3. `sequence`: Visual stage or chronological progression.
   - Glyph: `→`
   - Stroke: Indigo (`#6366f1`), width 2px, marker arrow.
   - Screen-reader text: `"Sequence: comes before target: [label]"`
4. `association`: General associative relation.
   - Glyph: `—`
   - Stroke: Zinc (`#52525b`), width 1.5px, dashed pattern `3,3`.
   - Screen-reader text: `"Association: related to target: [label]"`

Accessibility standard: Meaning is communicated through distinct non-color glyphs (`↳`, `✦`, `→`, `—`), distinct SVG stroke-dash patterns, and explicit `role="img"` ARIA labels.

---

## 9. Workflow Lab Handoff & Selection Promotion

### Workflow Lab Blocks
- `WorkflowBlock.tsx` displays saved recipes from `workflows/{id}`.
- Cost Preview: Shows calculated cost when determined, or clearly reports `"Unavailable (Calculated at runtime)"`. Guessed or fabricated values are forbidden.
- Execution: Triggering "Run" executes the exact same canonical pipeline as Workflow Lab, generating a real `workflow_run` receipt block.

### Promotion to Recipe (`PromoteToWorkflowModal.tsx`)
- Allows artists to select compatible blocks (notes, documents, assets) on the canvas and promote them to a reusable Workflow Lab recipe.
- Previews the converted node sequence, validates inputs, and saves through `saveWorkflow` without modifying the original canvas blocks.

---

## 10. Conductor & Agent Tool Suite

Conductor interacts with Project Canvas through structured, schema-validated tools:
1. `CanvasTools.canvas_push`: Pushes cards, tables, charts, or markdown to the canvas when active project context exists, recording creator provenance and correlation IDs.
2. `ProjectCanvasTools`:
   - `canvas_add_block`: Adds note, asset, text, or frame blocks.
   - `canvas_update_block`: Updates positions, dimensions, or settings.
   - `canvas_remove_block`: Removes canvas placement (never deletes canonical source).
   - `canvas_link_blocks`: Creates semantic edges with validation preventing duplicate or self-referential edges.
   - `canvas_get_state`: Reads active canvas blocks and edges for agent spatial reasoning.

Safety Policy: Agents are strictly prohibited from deleting canonical notes, workflows, or assets, and cannot execute consequential workflows without explicit human approval.

---

## 11. Lifecycle Templates, Collaboration & History

### Lifecycle Templates (`LifecycleTemplateService.ts`)
- 8-stage canonical layout:
  `create → prepare → register → deliver → release → track → operate → repeat`
- Formatted as visual lanes / frames (`FrameBlock.tsx`).
- Stages are organizational guides only and do NOT execute automated workflow tasks.

### Collaboration (`CanvasCommentModal.tsx`)
- Supports block-level and region-level threaded comments.
- Tracks author, timestamp, resolved status, and deep-links directly to target blocks.

### Canvas History (`CanvasSnapshotModal.tsx`)
- Provides named, timestamped canvas snapshots.
- Restoring a layout snapshot updates block positions and edges without mutating or deleting underlying canonical assets or notes.

---

## 12. Testing Commands & Verification Protocols

Run the complete Project Canvas verification suites:

```bash
# 1. Project Canvas test suite (49 unit & integration tests)
npx vitest run packages/renderer/src/modules/project-canvas/

# 2. Phase 1 Acceptance suite
npx vitest run packages/renderer/src/modules/project-canvas/__tests__/phase1Acceptance.test.tsx

# 3. Phase 2 Acceptance suite
npx vitest run packages/renderer/src/modules/project-canvas/__tests__/phase2Acceptance.test.tsx

# 4. Phase 3 Acceptance suite
npx vitest run packages/renderer/src/modules/project-canvas/__tests__/phase3Acceptance.test.tsx

# 5. Creative Canvas regression tests
npx vitest run packages/renderer/src/modules/creative/components/__tests__/InfiniteCanvas.test.tsx packages/renderer/src/modules/creative/components/CreativeCanvas.interaction.test.tsx

# 6. Full Renderer Typecheck
npm run typecheck:renderer

# 7. Project Canvas ESLint check
npx eslint packages/renderer/src/modules/project-canvas/ packages/renderer/src/services/agent/tools/ProjectCanvasTools.ts packages/renderer/src/services/agent/tools/CanvasTools.ts
```

### Known Limitations & Deferred Work
- Real-time collaborative cursor presence relies on Firebase WebRTC signaling (deferred to dedicated multi-player release).
- Large media rendering uses virtualized DOM bounds; canvas block count is optimized for up to 300 simultaneous visible entities before LOD (Level of Detail) downsampling.

