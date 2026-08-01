# Video Generation Validation Flowchart

This flowchart maps the high-level architecture and security boundaries for the Video Generation pipeline, specifically addressing the admission controls and validations required for ISSUE-1232, ISSUE-1233, ISSUE-1235, ISSUE-1246, and ISSUE-1247.

```mermaid
graph TD
    UserAction["User Action: Create Video/Image Job"] --> UIComponent["UI Component (Creative Studio)"]
    
    UIComponent --> ClientValidation["Client-Side Admission & Contracts (ISSUE-1232/1233)"]
    ClientValidation --> FirestoreWrite["Firestore: Write videoJobs / imageJobs"]
    
    FirestoreWrite --> RulesEngine{"Firestore Security Rules (ISSUE-1235)"}
    
    RulesEngine -- Deny --> ErrorState["Rejection: Unauthenticated/Invalid Write"]
    RulesEngine -- Allow --> GatewayTrigger["Cloud Function Trigger (videoJobOrchestrator)"]
    
    GatewayTrigger --> GatewayValidation["Gateway Validation (ISSUE-1247)"]
    GatewayValidation -- Valid URIs & Admission --> JobQueue["Inngest/Background Job Queue"]
    
    JobQueue --> WorkerExecution["Worker Execution (V3 reservations)"]
    WorkerExecution --> ConcurrencyCheck{"Concurrency Check (ISSUE-1246)"}
    
    ConcurrencyCheck -- Single Worker --> VertexAI["Vertex AI API (Generation)"]
    ConcurrencyCheck -- Duplicate --> AbortDuplicate["Abort: Job already claimed"]
    
    VertexAI --> OutputPersistence["Storage & Firestore Update"]
    OutputPersistence --> UIComponent
    
    style UserAction fill:#e0f7fa,stroke:#00acc1,stroke-width:2px
    style UIComponent fill:#00D4FF,stroke:#00acc1,stroke-width:2px
    style ClientValidation fill:#00D4FF,stroke:#00acc1,stroke-width:2px
    
    style RulesEngine fill:#FF00FF,stroke:#c51162,stroke-width:2px
    style ConcurrencyCheck fill:#FF00FF,stroke:#c51162,stroke-width:2px
    
    style FirestoreWrite fill:#FF8C00,stroke:#e65100,stroke-width:2px
    style OutputPersistence fill:#FF8C00,stroke:#e65100,stroke-width:2px
    
    style GatewayTrigger fill:#8A2BE2,stroke:#4a148c,stroke-width:2px
    style GatewayValidation fill:#8A2BE2,stroke:#4a148c,stroke-width:2px
    style JobQueue fill:#8A2BE2,stroke:#4a148c,stroke-width:2px
    
    style VertexAI fill:#39FF14,stroke:#1b5e20,stroke-width:2px
```

## Flow Transitions

1. **User Action to Client Validation**: The user initiates a video or image generation job from the UI. The client must adhere to the canonical generation admission contracts (ISSUE-1232, 1233), rejecting raw `clip.src` values and bypassing legacy callers.
2. **Firestore Rules Engine**: The client writes to `videoJobs` or `imageJobs`. Firestore security rules evaluate the write. It must reject unauthenticated writes, cross-owner writes, and direct execution without server admission (ISSUE-1235).
3. **Gateway Validation**: The Cloud Function triggers on the new job. The Gateway validates caller-supplied Cloud Storage URIs to ensure backend readability and security (ISSUE-1247).
4. **Concurrency Check**: Before executing the paid generation, the worker claims the job. V3 reservations ensure that if two workers pick up the same job, only one proceeds and settles the reservation, preventing duplicate execution (ISSUE-1246).
5. **Vertex AI Execution**: The validated and exclusively claimed job is sent to Vertex AI for generation. Output is persisted back to Storage/Firestore and reflected in the UI.
