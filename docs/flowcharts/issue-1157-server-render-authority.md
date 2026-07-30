# ISSUE-1157 Private Server Render Authority

This map documents the Phase A local contract. It separates renderer intent from
server admission, provider authority, private object identity, and terminal-only
authorized readback. Phase B public sharing and deployed acceptance remain open.

```mermaid
flowchart TD
    User["User selects Compile Showreel"] --> Compiler["Storyboard canonical compiler"]
    Compiler --> SourceGate{"Canonical video slots and verified master?"}
    SourceGate -->|No| Closed["Fail closed with actionable error"]
    SourceGate -->|Yes| QueueCall["Authenticated renderVideo callable"]

    QueueCall --> SecurityGate["App Check, verified account, entitlement, Arcjet"]
    SecurityGate --> ProjectAuth["Central project and organization authorization"]
    ProjectAuth --> MediaAuth["Canonical owner media validation"]
    MediaAuth --> Budget["Server cost reservation"]
    Budget --> Job["Server-created videoJobs record"]
    Job --> Event["Server-created private output identity"]

    Event --> WorkerAuth["Worker rechecks durable job authority"]
    WorkerAuth --> Transcoder["Existing Transcoder stitch and master mix"]
    Transcoder --> Inspect["Inspect exact private output generation"]
    Inspect --> Terminal["Persist completed or failed terminal receipt"]

    User --> ReceiptCall["Authenticated getVideoRenderReceipt callable"]
    ReceiptCall --> ReceiptSecurity["App Check, verified account, entitlement, Arcjet"]
    ReceiptSecurity --> ReceiptProject["Central project and organization authorization"]
    ReceiptProject --> StatusGate{"Durable job status"}
    StatusGate -->|Queued or running| Lifecycle["Return job ID, phase, and progress only"]
    StatusGate -->|Failed| Failure["Return typed failure without URL"]
    StatusGate -->|Completed| RevokeGate{"Access revoked?"}
    RevokeGate -->|Yes| Denied["Deny terminal access"]
    RevokeGate -->|No| GenerationGate["Match exact path, generation, and MP4 MIME"]
    GenerationGate --> Signed["Issue generation-bound URL for at most five minutes"]
    Signed --> UI["Show Copy and Download controls"]

    StorageRules["Storage Rules deny all private-renders client access"] -.-> GenerationGate
    Parallel["Parallel renderer"] --> Unsupported["Typed unsupported state; no fabricated URL"]

    classDef ui fill:#dff7ff,stroke:#00a7c4,stroke-width:2px,color:#082f49;
    classDef service fill:#eee7ff,stroke:#7c3aed,stroke-width:2px,color:#2e1065;
    classDef data fill:#fff2d8,stroke:#d97706,stroke-width:2px,color:#451a03;
    classDef cloud fill:#e2ffe7,stroke:#16a34a,stroke-width:2px,color:#052e16;
    classDef gate fill:#ffe4f3,stroke:#db2777,stroke-width:2px,color:#500724;

    class User,Compiler,Lifecycle,Failure,UI ui;
    class QueueCall,SecurityGate,ProjectAuth,MediaAuth,ReceiptCall,ReceiptSecurity,ReceiptProject service;
    class Budget,Job,Event,Terminal,StorageRules data;
    class WorkerAuth,Transcoder,Inspect,Signed cloud;
    class SourceGate,Closed,StatusGate,RevokeGate,Denied,GenerationGate,Parallel,Unsupported gate;
```

## Transition breakdown

1. `StoryboardTimeline` compiles the storyboard against the active app project.
   Every rendered slot must carry a `gs://` canonical source, and exactly one
   verified canonical master must remain attached; preview and blob URLs never
   become render authority.
2. `RenderService` sends only composition input plus the active project and
   organization IDs to `renderVideo`. The client cannot select a bucket, object
   path, privacy policy, or provider configuration.
3. The callable applies App Check, verified authentication, server entitlement,
   and Arcjet protection before centralized project authorization, media
   verification, cost reservation, durable job creation, and queue dispatch.
4. The server creates the private identity from authenticated owner, authorized
   project, and server-created job ID. The worker rechecks that identity against
   the durable job before the existing Transcoder contract can be invoked.
5. A successful worker inspects the exact expected MP4, persists its generation,
   and marks the job completed. Failures persist a typed terminal failure without
   an asset URL.
6. Receipt reads repeat request protection and centralized project authorization.
   Queued/running/failed states never inspect or sign Storage; a completed,
   non-revoked job must match its exact expected object path, generation, and MIME.
7. The maximum-five-minute signed URL is returned only after those checks.
   Storyboard UI displays job lifecycle throughout and renders Copy/Download only
   for the completed receipt.
8. Storage Rules independently deny all direct client operations on
   `private-renders`. Parallel output remains typed unsupported until a separate
   server-owned chunk/stitch receipt contract exists.
