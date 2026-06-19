# White Glove Ingestion Flowchart

This diagram outlines the macro-level architecture of the White Glove Asset Ingestion System, tracing how massive artist assets move from the frontend UI into structured Firestore records via Firebase Storage and Cloud Functions.

```mermaid
graph TD
    %% User Inputs & UI Layer
    UserTrigger["Manager/Artist Drops Files"] --> FileUploadUI["FileUpload UI Component"]
    FileUploadUI --> Validation["Client-Side Validation (Size/Type)"]
    
    %% State Management Layer
    Validation -->|Valid| QueueSlice["UploadQueueSlice (Zustand)"]
    Validation -->|Invalid| ErrorState["UI Error Display"]
    QueueSlice --> IngestService["WhiteGloveIngestionService"]
    
    %% Service & Cloud Logic Layer
    IngestService -->|Resumable Upload| FBStorage["Firebase Storage gs://ingest/white-glove/"]
    FBStorage -.->|Upload Progress| QueueSlice
    
    %% Cloud Functions Backend Layer
    FBStorage -->|onObjectFinalized| CloudFunction["Cloud Function: onWhiteGloveAssetUploaded"]
    CloudFunction --> AnalysisRouter{"Asset Type Router"}
    
    AnalysisRouter -->|Audio| AudioExtractor["Extract ID3 / Essentia.js Analysis"]
    AnalysisRouter -->|Visual| ImageProcessor["Extract EXIF / Generate Thumbnails"]
    AnalysisRouter -->|Archive| UnzipWorker["Unpack ZIP / Validate Pro Tools Session"]
    
    %% Database Layer
    AudioExtractor --> FirestoreDB["Firestore: /artists/{id}/assets"]
    ImageProcessor --> FirestoreDB
    UnzipWorker --> FirestoreDB
    
    style UserTrigger fill:#e0f7fa,stroke:#00acc1,stroke-width:2px
    style FileUploadUI fill:#e0f7fa,stroke:#00acc1,stroke-width:2px
    style QueueSlice fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    style IngestService fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    style FBStorage fill:#efebe9,stroke:#ff8f00,stroke-width:2px
    style CloudFunction fill:#efebe9,stroke:#39FF14,stroke-width:2px
    style AnalysisRouter fill:#efebe9,stroke:#39FF14,stroke-width:2px
    style AudioExtractor fill:#efebe9,stroke:#39FF14,stroke-width:2px
    style ImageProcessor fill:#efebe9,stroke:#39FF14,stroke-width:2px
    style UnzipWorker fill:#efebe9,stroke:#39FF14,stroke-width:2px
    style FirestoreDB fill:#efebe9,stroke:#ff8f00,stroke-width:2px
    style ErrorState fill:#ffebee,stroke:#ff00ff,stroke-width:2px
```

## Transition Breakdown

1. **User Action to State Management:**
   - The user drags and drops a massive file (e.g., a 5GB Pro Tools ZIP) into the `FileUploadUI`.
   - The UI runs local client-side validation to ensure the file complies with our security formats.
   - Once validated, the item is pushed into the `UploadQueueSlice` in Zustand, setting its status to `pending`.

2. **Frontend Service Execution:**
   - The `WhiteGloveIngestionService` detects a new pending item in the queue.
   - It initializes a resumable upload task (`uploadBytesResumable`) to the Firebase Storage bucket.
   - It binds an `on` listener to the Firebase task, pumping real-time progress events back into the `UploadQueueSlice` (which natively updates the UI progress bars).

3. **Backend Trigger & Extraction:**
   - Once the file successfully finalizes in `gs://<bucket>/ingest/white-glove/<userId>`, Firebase automatically triggers the `onWhiteGloveAssetUploaded` Gen 2 Cloud Function.
   - The Cloud Function acts as an Asset Type Router. Depending on the MIME type and extension, it routes the file to a specialized worker.
   - Audio files get their metadata ripped out; visuals get compressed thumbnails generated; ZIP files get unrolled and structurally validated.

4. **Database Finalization:**
   - All extracted metadata, physical bucket paths, and associated artist IDs are constructed into a clean object and written to the Firestore `/artists/{userId}/assets` collection.
   - The UI (which can subscribe to this collection) will instantly reflect that the new asset has been successfully processed and is ready for use.
