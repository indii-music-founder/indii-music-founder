# Canonical Secure Owner-Isolated Knowledge Base & RAG Architecture

```mermaid
flowchart TD
    subgraph Client ["Renderer (Browser / Electron App)"]
        UI["Knowledge Base UI"]
        KRS["KnowledgeRetrievalService"]
    end

    subgraph Storage ["Cloud Storage"]
        GCS["rag-sources/{uid}/{sha256}/original.{ext}"]
    end

    subgraph API ["Firebase Cloud Functions (Node.js 22, Gen 2)"]
        CKU["createKnowledgeUpload"]
        FKU["finalizeKnowledgeUpload"]
        QKB["queryKnowledgeBase / streamKnowledgeQuery"]
        DKD["deleteKnowledgeDocument"]
    end

    subgraph Worker ["Cloud Tasks & Indexing Worker"]
        CT["Cloud Tasks Queue"]
        IKW["indexKnowledgeDocumentWorker"]
    end

    subgraph Firestore ["Cloud Firestore (Vector Search)"]
        DOCS["users/{uid}/ragDocuments/{documentId}"]
        CHUNKS["users/{uid}/ragChunks/{chunkId} (768-dim Index)"]
        QUERIES["users/{uid}/ragQueries/{queryId}"]
        RECEIPTS["users/{uid}/ragReceipts/{receiptId}"]
    end

    subgraph Vertex ["Google Vertex AI (ADC Authentication)"]
        EMB_DOC["text-embedding-004 (RETRIEVAL_DOCUMENT)"]
        EMB_QUERY["text-embedding-004 (RETRIEVAL_QUERY)"]
        GEMINI["gemini-3-flash-preview (Answer Synthesis)"]
    end

    %% Upload Flow
    UI -->|1. Select File| KRS
    KRS -->|2. Call createKnowledgeUpload| CKU
    CKU -->|Verify Entitlement/Auth| DOCS
    CKU -->|3. Return storagePath & docId| KRS
    KRS -->|4. Upload Bytes with SHA-256 Metadata| GCS
    KRS -->|5. Call finalizeKnowledgeUpload| FKU
    FKU -->|Verify GCS Gen & SHA-256| GCS
    FKU -->|State: queued| DOCS
    FKU -->|6. Enqueue Indexing Job| CT

    %% Indexing Worker Flow
    CT -->|7. Trigger Worker| IKW
    IKW -->|8. Fetch Exact Storage Gen| GCS
    IKW -->|Recompute SHA-256 & Parse Text/PDF| IKW
    IKW -->|9. Generate 768-dim Embeddings| EMB_DOC
    IKW -->|10. Batch Write Chunks & Receipt| CHUNKS
    IKW -->|State: active| DOCS
    IKW -->|Write Receipt| RECEIPTS

    %% Retrieval & Query Flow
    UI -->|11. Ask Question| KRS
    KRS -->|12. Call queryKnowledgeBase| QKB
    QKB -->|Verify Entitlement/AppCheck| QKB
    QKB -->|13. Embed Query| EMB_QUERY
    QKB -->|14. Vector Search (cos/l2)| CHUNKS
    QKB -->|15. Synthesize Answer with Citations| GEMINI
    QKB -->|Write Query Receipt| QUERIES
    QKB -->|16. Return Answer + Citations| KRS

    %% Deletion Flow
    UI -->|Delete Document| KRS
    KRS -->|Call deleteKnowledgeDocument| DKD
    DKD -->|State: deleting| DOCS
    DKD -->|Delete Chunks| CHUNKS
    DKD -->|Delete Source Object| GCS
    DKD -->|State: deleted| DOCS
```

## Transition Breakdown

1. The authenticated owner requests an upload reservation and receives a
   server-selected document ID and owner-scoped Storage path.
2. The client uploads the source bytes with their SHA-256 metadata, then asks
   the backend to finalize the exact object generation.
3. Finalization revalidates ownership, generation, and content identity before
   creating a queued indexing record and Cloud Task.
4. The indexing worker downloads the pinned generation, recomputes the hash,
   parses the source, creates document embeddings in Vertex AI, and writes
   owner-rooted chunks plus an immutable receipt.
5. A query is admitted through Auth, App Check, and entitlement checks before
   its embedding is compared only with that owner's indexed chunks.
6. Gemini synthesizes an answer from bounded, untrusted reference text and
   returns citations while the backend records a query receipt.
7. Deletion transitions the document through `deleting`, removes its chunks
   and pinned source object, and only then records the terminal `deleted`
   state.

## Architectural Guarantee & Compliance Rules

1. **Owner Isolation**: All Firestore subcollections (`ragDocuments`, `ragChunks`, `ragQueries`, `ragReceipts`) are strictly rooted under `users/{uid}/`. Storage objects are strictly rooted under `rag-sources/{uid}/{sha256}/original.{ext}`.
2. **Immutable Generation Binding**: Upload finalization, indexing, and deletion bind to exact Cloud Storage generation IDs. Object replacement or hash spoofing between upload and indexing fails closed.
3. **Vertex ADC Authentication**: Embeddings (`text-embedding-004` at 768 dimensions) and answer generation (`gemini-3-flash-preview`) use Google Application Default Credentials (ADC) via `@google/genai` or `@google-cloud/vertexai`. Zero Gemini Developer API keys, browser provider calls, or unauthenticated HTTP proxies.
4. **Strict Context Boundaries**: Answer synthesis prompts treat retrieved chunk text as untrusted quoted reference material. Embedded prompt injection in uploaded files is strictly neutralized.
