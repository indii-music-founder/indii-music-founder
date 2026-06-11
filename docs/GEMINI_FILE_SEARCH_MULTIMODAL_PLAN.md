# Gemini File Search Multimodal RAG — Gap Analysis & Implementation Plan

> **Status:** Decisions locked. Ready for implementation.
> **Announced:** May 5, 2026 | **Last updated:** 2026-05-09 (v2 — embedding model deep-dive applied)

## Context

Google expanded the Gemini API File Search tool with three new capabilities: native multimodal embedding/search, custom metadata filtering, and page-level citations. indii already ships a fully-deployed File Search RAG stack (`GeminiRetrievalService`, `RAGAgent`, `bulk-ingest-rag.ts`). This document defines the deltas to adopt.

---

## gemini-embedding-2 vs gemini-embedding-001 — Full Spec Comparison

| | `gemini-embedding-001` | `gemini-embedding-2` |
|---|---|---|
| **Modalities** | Text only | Text, images (PNG/JPEG, 6/req), **audio (MP3/WAV ≤180s)**, **video (MP4/MOV ≤120s, 32 frames)**, PDFs (≤6 pages/call) |
| **Token limit** | 2,048 | 8,192 |
| **Output dims** | 128–3,072 | 128–3,072 (recommended 768/1536/3072) |
| **Task types** | `task_type` param (RETRIEVAL_QUERY, RETRIEVAL_DOCUMENT, SEMANTIC_SIMILARITY, etc.) | Inline prompt instructions (e.g. `"task: search result \| query: {content}"`) |
| **Aggregation** | Individual embedding per input | Single aggregated embedding by default |
| **Normalization** | Manual for non-3072 dims | Automatic for truncated dims |
| **Batch API** | Yes (50% cost) | Yes (50% cost) |

> **CRITICAL:** Embedding spaces are incompatible between models. Existing embeddings must be fully re-embedded when upgrading a store — you cannot mix models within a store.

---

## What's New (May 5, 2026 Announcement)

| Feature | Detail |
|---|---|
| **Multimodal embeddings** | `gemini-embedding-2` embeds text + images + audio + video natively. File Search UI currently surface images; audio/video indexing may be preview. |
| **Custom metadata** | Key-value labels on import (`{key, string_value \| numeric_value}`); query-time filters. |
| **Page citations** | `chunk.retrieved_context.page_number` in `grounding_metadata`. Image chunks return `media_id`. |
| **Pricing** | Storage + query embeddings free. Indexing charged per embedding model. Batch API = 50% off. |

---

## What indii Already Has

- `packages/renderer/src/services/rag/GeminiRetrievalService.ts` — full FileSearchStore lifecycle (`ensureFileSearchStore`, `uploadFile`, `importFileToStore`, `query`, `streamQuery`).
- `packages/renderer/src/services/agent/RAGAgent.ts` — preconditions agent tasks with KB retrieval.
- `scripts/bulk-ingest-rag.ts` — hash-based change detection, multi-store sync across career/contracts/finance/licensing domains.
- `packages/renderer/src/services/ai/GeminiFileService.ts` — Files API resumable upload (Electron-renderer compatible).
- `BrowserAgentService.ts` — multimodal Computer Use via inline base64 PNGs (separate path, not File Search).
- `HighLevelAPI.ts` — `analyzeImage / analyzeMultimodal / analyzeAudio / analyzeFileURI` wrappers.

---

## Gap Analysis (updated)

| Capability | Status | Action |
|---|---|---|
| Text File Search | ✅ Shipped | — |
| **Image File Search** | ❌ Images go inline via base64 — no persistence, no retrieval. | **Adopt** — brand kits, reference art, visual specs. New stores use `gemini-embedding-2`. |
| **Audio File Search** | ❌ Audio analyzed via HighLevelAPI inline only. | **Adopt (phase 2)** — masters, demos, reference tracks. `gemini-embedding-2`, ≤180s per clip. |
| **Video File Search** | ❌ No video in RAG pipeline at all. | **Defer** — low priority for now. |
| **Custom metadata** | ❌ No metadata on `importFileToStore`. | **Adopt** — augment existing stores with `artist_id`, `doc_type`, `status`, `year`. |
| **Page citations** | ❌ `page_number` not surfaced. | **Adopt** — wire into `RAGAgent` + UI source chip. |
| **PDF page limit** | ⚠️ `gemini-embedding-2` indexes ≤6 pages per embedding call. Multi-page PDFs need chunking. | **Handle** — `bulk-ingest-rag.ts` must chunk PDFs >6 pages before import. |
| **task_type param** | ✅ Used on `embedding-001`. | ⚠️ **Remove for embedding-2 stores** — use inline prompt instructions instead. |
| **Batch API** | ❌ Not used. | **Adopt for bulk ingest** — 50% cost reduction. High value in `bulk-ingest-rag.ts`. |
| Pricing model | Stale docs | Update `directives/` |

---

## Decisions (Locked)

- **Stores**: Augment existing per-domain stores with metadata. No collapse, no migration. Add `artist_id`, `doc_type`, `status`, `year`.
- **Image ingestion**: Near-term. Brand kits are core artist identity. New image stores = `gemini-embedding-2`.
- **Audio ingestion**: Phase 2. Masters / demos are high-value retrieval targets once image path is proven.
- **Backfill**: No backfill. Legacy text stores stay on `embedding-001`. Technically required — embedding spaces are incompatible; any upgrade needs full re-index of a store.
- **Batch API**: Use for all bulk ingest in `bulk-ingest-rag.ts` — 50% cost reduction for free.

---

## Implementation Order

### 1. Page Citations (smallest diff, highest trust impact)
**Files:** `GeminiRetrievalService.ts:313`, `RAGAgent.ts:37,51`

- Read `page_number` from `response.candidates[0].grounding_metadata.groundingChunks[].retrievedContext`
- Pass through `RAGAgent` context injection as `source.page`
- Surface in agent response as source attribution chip — legal/contracts/finance domains

### 2. PDF Chunking (prerequisite for embedding-2 PDF support)
**Files:** `scripts/bulk-ingest-rag.ts:151-192`

- `gemini-embedding-2` processes ≤6 pages per embedding call
- Add PDF chunk splitter in `bulk-ingest-rag.ts` before import — split PDFs >6 pages into 6-page segments
- Filename convention: `contract_2024_p1-6.pdf`, `contract_2024_p7-12.pdf`

### 3. Multimodal Image Ingestion
**Files:** `GeminiRetrievalService.ts:212`, `scripts/bulk-ingest-rag.ts:151-192`, `GeminiFileService.ts`

- Update `ensureFileSearchStore` to accept `embeddingModel` param; default `gemini-embedding-001`
- New image stores: pass `models/gemini-embedding-2`
- Add image store domain to `bulk-ingest-rag.ts` (`brand_kit`, `reference_art`, `visual_specs`)
- **Remove `task_type` param for embedding-2 stores** — use inline prompt instruction instead
- Confirm `GeminiFileService` sends correct `content-type` for PNG/JPEG

### 4. Batch API for Bulk Ingest
**Files:** `scripts/bulk-ingest-rag.ts`

- Switch `bulk-ingest-rag.ts` embedding calls to Batch API endpoint — 50% cost reduction
- No functional change; same embeddings, same stores

### 5. Custom Metadata
**Files:** `GeminiRetrievalService.ts:254`, `scripts/bulk-ingest-rag.ts`, `RAGAgent.ts`

- Extend `importFileToStore` to accept `metadata: Array<{key: string, stringValue?: string, numericValue?: number}>`
- Add metadata schema to `bulk-ingest-rag.ts` ingest map: `{ artist_id, doc_type, status, year }`
- Update `query` / `streamQuery` to accept optional `metadataFilter`

### 6. Audio Ingestion (Phase 2)
**Files:** `scripts/bulk-ingest-rag.ts`, `GeminiRetrievalService.ts`

- Add audio store domain (`masters`, `demos`, `reference_tracks`)
- Enforce ≤180s clip limit — chunker for long-form audio
- Same `gemini-embedding-2` store pattern as images

### 7. Pricing / Docs Refresh
- Update `directives/` cost model (storage free, query embeddings free, batch = 50% off)

---

## Critical Files

| File | Key Lines |
|---|---|
| [packages/renderer/src/services/rag/GeminiRetrievalService.ts](../packages/renderer/src/services/rag/GeminiRetrievalService.ts) | 212 `ensureFileSearchStore`, 254 `importFileToStore`, 313 `query`, 334–348 tool config |
| [packages/renderer/src/services/agent/RAGAgent.ts](../packages/renderer/src/services/agent/RAGAgent.ts) | 37 query call, 51 context injection |
| [scripts/bulk-ingest-rag.ts](../scripts/bulk-ingest-rag.ts) | 151–192 ingest pipeline |
| [packages/renderer/src/services/ai/GeminiFileService.ts](../packages/renderer/src/services/ai/GeminiFileService.ts) | Resumable upload, MIME type handling |

---

## Verification Plan

- **Unit:** Extend `AgentArchitecture.test.ts` mocks for `page_number`, metadata, `embeddingModel` param
- **Integration:** `RAGAgent` test asserting `page_number` propagation
- **Live:** Ingest PDF (>6 pages) + PNG set; query; confirm citation + image retrieval in UI
- **Cost:** Verify batch API reduces indexing cost in `TokenUsageService`

---

## Sources

- [Gemini API File Search multimodal announcement (May 5 2026)](https://blog.google/innovation-and-ai/technology/developers-tools/expanded-gemini-api-file-search-multimodal-rag/)
- [Gemini Embeddings API docs](https://ai.google.dev/gemini-api/docs/embeddings)
- [Gemini Embedding 2 Enterprise docs](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/embedding-2)
- [File Search API docs](https://ai.google.dev/gemini-api/docs/file-search)
