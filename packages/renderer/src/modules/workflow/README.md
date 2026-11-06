# Flow-Be Engine (Workflow Lab)

> *"Flow be makin me happy"* 🎶

The **Flow-Be Engine** is the full-lifecycle, node-graph automation brain of indiiOS. Inspired by ComfyUI's strongly typed schema and content-addressable memoization, Flow-Be extends beyond image and video generation into an end-to-end music business flow system—from initial songwriting notes, audio mastering QC, and metadata assignment to split sheets, cover art, vertical canvas video, and DSP pre-flight.

---

## ⛓️ Key Capabilities

- **ComfyUI-Style Strongly Typed Sockets:** Explicit typed ports (`NOTE`, `AUDIO`, `AUDIO_QC`, `METADATA`, `SPLITS`, `RELEASE_PACKAGE`, `IMAGE`, `VIDEO`, `TEXT`, `TRIGGER`) ensure invalid wires are caught at the boundary.
- **Content-Addressable Memoization (`ExecutionCache`):** Node results are cached by a deterministic hash of inputs and config. Tweaking downstream rollout copy skips re-running upstream mastering QC and image/video models.
- **Full Music Industry Lifecycle:**
  - **Notes & Songwriting:** Pull lyrics and voice notes from the Notes system (`NotesService` / `notesSlice`), parse song sections, and save generated release recipes directly into the artist's notebook.
  - **Mastering & Audio QC:** Verifies -14.0 LUFS integrated loudness, -1.0 dBFS true peak, and zero clipping for streaming compliance.
  - **Rights & Metadata:** Formats DDEX metadata, assigns ISRC/UPC codes, and validates 100% balanced split sheets.
  - **Creative & Video:** Generates 3000x3000px streaming cover art and 9:16 vertical canvas loops for Spotify and TikTok.
  - **Distribution Pre-Flight:** Comprehensive checklist verification prior to DSP submission.
- **TypeSafe AI (JEV System One) Routing:** Router nodes delegate natural language conditions to TypeSafe's fast `noul` primitive (`judgeWorkflowCondition`) for sub-second semantic branching.
- **Human-in-the-Loop Checkpoints:** Gatekeeper nodes pause execution for review and approval before final release and distribution.

---

## 🏗️ Technical Architecture

- **`WorkflowLab.tsx`**: Three-panel UI workspace with the Flow-Be canvas.
- **`WorkflowEngine.ts`**: Core execution engine featuring topological dependency scheduling, cycle protection, execution caching, and lifecycle event callbacks.
- **`UniversalNode.tsx`**: Standardized node renderer with rich previews for Notes, Audio QC, Metadata, Splits, and Release Packages.
- **`nodeRegistry.ts`**: Central registry of department jobs, port contracts, and color schemes.
- **`typesafeJudgments.ts`**: Server-delegated TypeSafe AI System One decision contracts.
- **`workflowTemplates.ts`**: Turn-key playbooks, including the 14-node **Complete Music Release & Notes Suite**.
