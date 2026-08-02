# Knowledge (RAG) Pipeline Architecture

```mermaid
flowchart TD
    %% Roles
    User["User"]
    
    %% Storage
    Storage["Cloud Storage"]
    DB["Firestore"]
    
    %% Endpoints & Workers
    subgraph Functions
        Upload["createKnowledgeUpload"]
        Finalize["finalizeKnowledgeUpload"]
        Worker["indexKnowledgeDocumentWorker\nCloud Task"]
        Query["queryKnowledgeBase"]
    end
    
    %% External AI Services
    subgraph Vertex AI
        Embed["text-embedding-004"]
        Gen["gemini-3-flash-preview"]
    end

    %% Ingestion Flow
    User -- "1. Init Upload (SHA/Size)" --> Upload
    Upload -- "2. Return signed URL\n& create doc (state: uploading)" --> DB
    User -- "3. Upload File" --> Storage
    User -- "4. Finalize" --> Finalize
    Finalize -- "5. Verify size, SHA, generation" --> Storage
    Finalize -- "6. State = queued\nEnqueues Cloud Task" --> Worker
    
    %% Worker Flow
    Worker -- "7. Fetch exact generation\nLease doc (state: indexing)" --> Storage
    Worker -- "8. Parse PDF/MD/TXT & Chunk" --> Worker
    Worker -- "9. Generate 768-dim embeddings" --> Embed
    Worker -- "10. BatchWrite Chunks & State = active" --> DB
    
    %% Query Flow
    User -- "11. Query" --> Query
    Query -- "12. Embed query" --> Embed
    Query -- "13. Vector Search (findNearest)\nFilter by 'active' docs & minRelevance" --> DB
    Query -- "14. Generate grounded answer" --> Gen
    Query -- "15. Return Answer & Citations" --> User
```

## Transition Breakdown
This flowchart maps the strict, durable, and idempotent Knowledge pipeline for indii, fixing issues 1248-1253.
- **Upload Phase**: Enforces strict metadata constraints and validates SHA-256 and byte sizes to prevent rogue uploads.
- **Task Dispatch**: Replaces a dangling promise with a reliable Cloud Task dispatch for the index worker.
- **Worker Phase**: Uses a transactional lease to enter the `indexing` state and a `BulkWriter` for atomic promotion to `active`.
- **Query Phase**: Utilizes exact document state filtering and a `minRelevance` threshold on the cosine distance before passing citations to Vertex AI for answer generation.
