# Secure Generation Execution Isolation & Proxy Routing Flowchart

This flowchart visualizes the secure, production-grade architecture of the direct image and video generation pipelines in the **indii** studio. 

By eliminating client-side `@google/genai` calls and key exposures (`VITE_API_KEY`), all operations are routed through authenticated backend Cloud Function proxies (`generateImageV3` and `triggerVideoJob`). This decouples frontend rendering from high-cost AI operations and isolates execution security completely on the backend.

---

## Architecture Flowchart

```mermaid
graph TD
    %% Node Definitions
    subgraph UI_Layer ["1. UI & Client Interaction Layer"]
        Tab["DirectGenerationTab (UI)"]
        Hook["useDirectGeneration (Hook)"]
        ActiveJobs["React activeJobs (State)"]
        Gallery["Glassmorphic Progress Card"]
    end

    subgraph Service_Proxy_Layer ["2. Client Service Proxy Layer"]
        DirectImg["DirectImageGenerator.ts"]
        VideoGen["VideoGenerationService.ts"]
        HttpCallImg["httpsCallable: generateImageV3"]
        HttpCallVid["httpsCallable: triggerVideoJob"]
    end

    subgraph Firebase_Cloud_Layer ["3. Authenticated Cloud Gateway"]
        AuthCheck{"Auth & App Check"}
        RateLimit{"Rate Limiter"}
        OrgAccess{"Org Access Guard"}
    end

    subgraph Database_Layer ["4. Cloud Database & State Layer"]
        FirestoreImg["Firestore Metadata"]
        FirestoreVid["Firestore: videoJobs/{jobId}"]
        StorageBucket["Firebase Cloud Storage"]
    end

    subgraph Secure_Worker_Layer ["5. Secure Execution Worker (us-central1)"]
        OnCreateTrigger["executeVideoJob (onCreate)"]
        DirectWorker["generateVideoDirect (Worker)"]
        VertexSDK["GoogleGenAI SDK (ADC Auth)"]
        VertexAPI["Vertex AI Operations API"]
        StorageUpload["smartSave / download to Storage"]
    end

    %% Flow Paths & Transitions
    Tab -- "User clicks Generate" --> Hook
    Hook -- "1. Pre-generate UUID jobId" --> ActiveJobs
    ActiveJobs -- "2. Immediate loader render" --> Gallery
    
    %% Image Pipeline path
    Hook -- "Image mode: trigger" --> DirectImg
    DirectImg -- "No client-side key used" --> HttpCallImg
    HttpCallImg --> AuthCheck
    
    %% Video Pipeline path
    Hook -- "Video mode: trigger" --> HttpCallVid
    HttpCallVid --> AuthCheck
    
    %% Cloud Gateways
    AuthCheck -- "Valid token" --> RateLimit
    RateLimit -- "Within rate bounds" --> OrgAccess
    OrgAccess -- "Authorized" --> FirestoreVid
    
    %% Video Execution
    FirestoreVid -- "status: 'queued'" --> OnCreateTrigger
    OnCreateTrigger --> DirectWorker
    DirectWorker -- "status: 'processing'" --> FirestoreVid
    DirectWorker -- "ADC auth (no keys)" --> VertexSDK
    VertexSDK -- "Poll operations" --> VertexAPI
    VertexAPI -- "Update attempts (1%-99%)" --> FirestoreVid
    VertexAPI -- "Success (Inline base64)" --> StorageUpload
    StorageUpload -- "Public mp4 URL" --> StorageBucket
    StorageUpload -- "status: 'completed'" --> FirestoreVid
    
    %% Image Execution
    AuthCheck -- "generateImageV3 handler" --> FirestoreImg
    FirestoreImg -- "PRO / FAST model" --> VertexSDK
    VertexSDK -- "Generate base64" --> StorageUpload
    StorageUpload -- "Return base64 URIs" --> HttpCallImg
    HttpCallImg -- "Parse data URIs" --> DirectImg
    DirectImg -- "Resolve generated images" --> Hook
    
    %% Frontend Sync Polling
    VideoGen -- "subscribeToJob(jobId)" --> FirestoreVid
    FirestoreVid -. "Real-time updates" .-> Hook
    Hook -. "Update progress bar" .-> Gallery
    Hook -. "On completed: move loader" .-> Tab

    %% Styling
    classDef ui fill:#e0f7fa,stroke:#00acc1,stroke-width:2px;
    classDef service fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px;
    classDef cloud fill:#efebe9,stroke:#6d4c41,stroke-width:2px;
    classDef db fill:#ffe0b2,stroke:#ff9800,stroke-width:2px;
    classDef worker fill:#e8f5e9,stroke:#4caf50,stroke-width:2px;

    class Tab,Hook,ActiveJobs,Gallery ui;
    class DirectImg,VideoGen,HttpCallImg,HttpCallVid service;
    class AuthCheck,RateLimit,OrgAccess cloud;
    class FirestoreImg,FirestoreVid,StorageBucket db;
    class OnCreateTrigger,DirectWorker,VertexSDK,VertexAPI,StorageUpload worker;
```

---

## Detailed Transition Walkthrough

### 1. Job Allocation & Loader Instantiation (UI)
* **Trigger:** When the user clicks the "Generate" button within `DirectGenerationTab.tsx`, execution is delegated to the `useDirectGeneration` hook's handlers.
* **UX Optimistic Update:** A unique `jobId` is instantly allocated on the client side using `crypto.randomUUID()`. The hook pushes a mock job record with `{ id: jobId, status: 'queued', progress: 0 }` to the local React component state (`activeJobs`), which triggers the immediate visual rendering of a premium glassmorphic loader card in the canvas gallery.

### 2. Client-Side Proxy Service Call
* **Image Path:** The generator redirects the payload to `DirectImageGenerator.ts` which invokes `httpsCallable(functions, 'generateImageV3')`. It passes the prompt, aspect ratio, model tier, and configuration parameters.
* **Video Path:** The hook bypasses direct client-side generation and immediately invokes `httpsCallable(functions, 'triggerVideoJob')`. It formats the payload to strictly satisfy the server's `VideoJobSchema` rules, passing along `jobId`, the enriched timeline sequence prompt, resolutions, duration, and reference/ingredient byte structures.

### 3. Server-Side Security & Token Verification (Cloud Layer)
* **Auth & App Check:** The Cloud Function verifies that the Firebase ID token is valid and refreshed, blocking all unauthorized access. 
* **Rate Limiting:** The user's UID is checked against the server's redis/firestore rate-limit window to protect resources.
* **Organization Access:** The server verifies membership for any targeted organization, preventing IDOR/access injection attacks.

### 4. Asynchronous Background Execution (Worker Layer)
* **Firestore Trigger:** The `triggerVideoJob` function creates the primary job document under `videoJobs/{jobId}` with status `"queued"`. This triggers the long-running background Cloud Function trigger `executeVideoJob`.
* **Worker Execution:** The worker starts `generateVideoDirect()`, updating the job status to `"processing"` (which the client's live subscription receives immediately).
* **ADC Auth:** The worker instantiates the `@google/genai` client using server-side Application Default Credentials (ADC) without hardcoding or exposing keys.
* **Operations Polling:** The worker triggers `ai.models.generateVideos()` and queries the operations status loop every 10 seconds. In each loop, progress is calculated (`Math.min(99, Math.round((attempt / maxAttempts) * 100))`) and written back to Firestore, causing the client's glassmorphic progress bar to animate smoothly in real-time.
* **Cloud Storage Durable Sync:** On operation completion, the raw base64 video is fetched and securely uploaded to the public Firebase Cloud Storage bucket. The Firestore job status is set to `"completed"` alongside the durable Storage public URL.

### 5. Final UX Resolution
* **Subscription loop:** The client-side hook, which subscribed to `VideoGeneration.subscribeToJob(jobId)`, receives the `"completed"` Firestore snapshot.
* **Completion Handover:** The final URL propagates to Zustand store history, a success toast triggers, the loader card fades out, and the newly generated video asset loads seamlessly inside the media gallery.
