# Flow-Be Engine (Workflow Lab)

> *"Flow be makin me happy"* 🎶

The **Flow-Be Engine** is the full-lifecycle, node-graph automation brain of indiiOS. Inspired by ComfyUI's strongly typed sockets, topological DAG scheduling, and content-addressable memoization, Flow-Be is tailored specifically for independent music artists.

Unlike traditional node engines that focus exclusively on visual generation (stable diffusion / video latents), Flow-Be spans the entire music industry lifecycle—connecting an artist's songwriting ideas in their personal notebook (`NotesService` / `notesSlice`) with automated mastering QC, DDEX metadata formatting, ISRC/UPC generation, 100% balanced split sheets, cover art, canvas videos, and digital service provider (DSP) preflight.

---

## 🆚 ComfyUI vs. Flow-Be Engine Architecture

| Architectural Dimension | ComfyUI | Flow-Be Engine (indiiOS) |
|---|---|---|
| **Target Domain** | AI Image & Video Latents | Independent Music Artist Business & Creative Lifecycle |
| **Execution Paradigm** | Python backend, PyTorch tensors, latent noise models | React Flow frontend DAG + TypeScript `WorkflowEngine` |
| **Socket Type System** | `MODEL`, `CLIP`, `VAE`, `LATENT`, `IMAGE` | `NOTE`, `AUDIO`, `AUDIO_QC`, `METADATA`, `SPLITS`, `RELEASE_PACKAGE`, `IMAGE`, `VIDEO`, `SUBGRAPH`, `TRIGGER` |
| **Caching & Memoization** | Content-addressable hash of node inputs/weights | Deterministic SHA-256 node cache key (`inputs` + `config` + `jobId`) |
| **Micro-Workflows** | Subgraphs / Node Groups | `subgraphNode` composite nodes with recursive engine execution, canvas encapsulation (`encapsulateSubgraph`), and in-place unwrapping (`expandSubgraph`) |
| **AI Collaboration** | Manual drag-and-drop node graph authoring | **AI Co-Pilot**: prompt-to-graph synthesis (`generateWorkflowFromPrompt`), collaborative graph edits (`modifyWorkflowWithAI`), and 3-way creative auditions (`auditionWorkflowVariants`) |
| **Semantic Routing** | Primitive Python boolean switches | Sub-second semantic classification via TypeSafe AI JEV `noul` primitive (`judgeWorkflowCondition`) |
| **Notebook Integration** | None | Reads songwriting concepts/lyrics directly from `Notes` store and saves final release packages back to Firestore |

---

## 🎛️ Department Nodes & Sockets

Flow-Be organizes nodes into domain-specific departments with strict input/output type contracts:

### 1. Notes Department (Songwriting & Concepts)
- **`note-input`**: Ingests notes, lyrics, audio memos, or song concepts from the artist's local/cloud notebook (`useStore.getState().notes`).
- **`lyrics-extract`**: Isolates verses, choruses, and hooks from raw notes to feed downstream metadata and video typography prompts.
- **`note-save`**: Persists generated plans, campaign calendars, and release metadata recipes back into the artist's notebook via `notesService.pushNote`.

### 2. Music Department (Mastering QC & Identifiers)
- **`music-audio-qc`**: Evaluates master audio files against streaming compliance standards:
  - Target: **-14.0 LUFS** integrated loudness ($\pm 1.0$ LUFS tolerance)
  - True Peak ceiling: **-1.0 dBFS** maximum to prevent inter-sample clipping on DSP transcoding
  - Emits structured `AudioQCAsset` with pass/fail telemetry.
- **`music-metadata`**: Aggregates track title, primary artist, featured artists, genre, and parental advisory flags into a validated `MusicMetadataAsset`.
- **`music-isrc-assign`**: Deterministically mints or validates standard 12-character International Standard Recording Codes (`CC-XXX-YY-NNNNN`).
- **`music-upc-assign`**: Validates or issues 12-digit Universal Product Codes for singles and albums.

### 3. Splits & Rights Department
- **`splits-compiler`**: Compiles master recording and publishing ownership allocations.
  - Enforces strict mathematical balance: total master shares must equal **100%** and total publishing shares must equal **100%**.
  - Flags unallocated or over-allocated percentages with decisive error boundaries.

### 4. Distribution & Release Department
- **`ddex-preflight`**: Executes an automated 5-point release readiness check:
  1. Audio master verified and QC passed
  2. Metadata complete (Title, Artist, Genre)
  3. Valid ISRC assigned
  4. Valid UPC assigned
  5. Split sheets balanced (100% Master / 100% Publishing)
  - Outputs a certified `ReleasePackageAsset` ready for DSP ingestion.

### 5. Creative & Video Departments
- **`art-department-job-0`**: Generates 3000x3000px high-resolution album and single cover artwork.
- **`video-generation`**: Produces 9:16 vertical looping canvas videos for Spotify, Instagram Reels, and TikTok.
- **`art-upscale-job`**: Upscales album artwork for high-DPI display and physical merchandise formats.

### 6. Logic & Human Gates
- **`router`**: Branches the DAG based on evaluated conditions. Supports fast TypeSafe AI semantic judgments via JEV `noul`.
- **`gatekeeper`**: Human-in-the-loop checkpoint pausing execution until the artist reviews and approves assets.

---

## 🧩 Micro-Workflows (Subgraphs & Nested Flows)

Large release campaigns can quickly produce overwhelming graphs of 30+ nodes. Flow-Be solves this through **Micro-Workflows**:

1. **Encapsulation (`encapsulateSubgraph`)**: Select 2 or more nodes on the canvas and click **Encapsulate**. The selected nodes collapse into a single composite `subgraphNode` with rewired boundary edges.
2. **Expansion (`expandSubgraph`)**: In the **Node Inspector**, click **Expand to Canvas** on any `subgraphNode` to unwrap the composite node back into its original constituent nodes and edges.
3. **Recursive Execution**: When `WorkflowEngine` encounters a `subgraphNode`, it spawns a child `WorkflowEngine` instance, pipes the parent inputs into the subgraph's entry node, executes the internal DAG with full caching, and forwards the terminal output downstream.
4. **Pre-Packaged Micro-Workflows**:
   - `micro-art-suite`: Concept → Artwork Generation → 4K Upscale
   - `micro-audio-qc`: Master Ingest → LUFS/dBTP Analysis → True Peak Compliance Gate
   - `micro-rights-metadata`: Metadata Assembly → ISRC/UPC Assignment → Balanced Split Sheets
   - `micro-social-hype`: Release Package → Multi-Platform Social Copy → Scheduled Campaign Posts

---

## 🤖 AI Co-Pilot & Collaboration Suite

Artists can co-create and edit workflows alongside the AI via natural language:

- **Generate with AI (`generateWorkflowFromPrompt`)**: Translates high-level prompts (e.g. *"Take my new song idea, check audio mastering, assign ISRC, make psychedelic cover art and a TikTok canvas, and prepare the release"*) into an executable DAG matching `WORKFLOW_JSON_SCHEMA`.
- **AI Edit Workflow (`modifyWorkflowWithAI`)**: Modifies an existing canvas in-place (e.g. *"Add a Gatekeeper approval step right before distribution preflight"* or *"Insert a 4K upscale step after cover art"*), preserving existing nodes and rewiring adjacent handles cleanly.
- **Audition 3 Creative Directions (`auditionWorkflowVariants`)**: In the **Node Inspector**, generate 3 distinctly different artistic or strategic directions for any department node, complete with creative rationales (e.g. Cinematic wide-lens bokeh vs. 35mm analog film grain vs. bold minimalist typography). One-click applies the chosen direction directly to the node.
- **Model Policy Adherence**: All generation and modification strictly uses approved models via `AI_MODELS.TEXT.AGENT` (`gemini-3.1-pro-preview` / `gemini-3-flash-preview`).

---

## ⚡ Content-Addressable Execution Cache (`ExecutionCache`)

Inspired by ComfyUI's latent cache, Flow-Be avoids re-executing expensive AI generation steps when unrelated downstream parameters change:

$$\text{CacheKey} = \text{SHA-256}(\text{jobId} + \text{canonicalInputs} + \text{nodeConfig})$$

- Running a workflow cold executes every node.
- Modifying only a downstream social copy prompt allows upstream artwork, audio QC, and metadata nodes to return instantaneously from the `ExecutionCache`.
- Explicit `bypassCache: true` can be supplied to force a fresh re-generation across the entire graph.

---

## 📐 TypeSafe AI (JEV System One) Integration

For fast, deterministic semantic classification in router nodes, Flow-Be integrates TypeSafe AI's JEV model:

```typescript
import { judgeWorkflowCondition } from '@/config/typesafeJudgments';

// Evaluates natural language conditions with sub-second latency
const conditionMet = await judgeWorkflowCondition(
    "Check if audio loudness is compliant for Spotify streaming",
    "-14.1 LUFS integrated, -1.0 dBFS true peak"
);
```

---

## 🧪 Verification & Test Suite

The Flow-Be Engine is covered by **54 comprehensive automated tests** across 6 test suites:

```bash
cd packages/renderer
npx vitest run src/modules/workflow/
```

- `WorkflowEngine.test.ts` (24 tests):
  - Topological sorting and linear execution
  - Dynamic branching via router nodes
  - Human gatekeeper pause/resume semantics
  - Notes Department ingest and Firestore write-backs
  - Mastering Audio QC (-14 LUFS, -1.0 dBTP)
  - Split sheet 100% balance enforcement
  - DDEX preflight release package validation
  - Recursive `subgraphNode` execution and terminal output forwarding
  - Content-addressable execution cache hits and invalidation
- `workflowGenerator.test.ts` (12 tests):
  - Natural language graph generation and structural schema validation
  - Disconnected edge rejection and unavailable job detection
  - In-place AI graph modification (`modifyWorkflowWithAI`)
  - 3-way creative audition variant generation and offline fallback
  - Micro-workflow encapsulation and expansion round-trips
- `UniversalNode.test.tsx` (6 tests):
  - Live card rendering for Note, Audio QC, Metadata, Splits, Release Package, and Subgraph assets
- `validationUtils.test.ts` (6 tests):
  - Typed port compatibility rules and socket validation
- `TheArchitect.test.tsx` (3 tests):
  - Graph integrity, cycle avoidance, and contract verification
- `workflowPersistence.test.ts` (3 tests):
  - Cloud Firestore save/load serialization with real viewport preservation
