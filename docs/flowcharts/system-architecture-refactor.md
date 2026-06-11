# System Architecture & Integration Refactor

This flowchart maps the unified backend architecture implemented during the transition from fragmented 3rd-party services to native Cloud Run/Firebase integration. It covers DSP ingestion, FSM orchestration, and DDEX pipelines.

```mermaid
graph TD
    %% Nodes
    UserTrigger["User UI (Ingest / Distribute)"]
    
    %% Ingestion Pipeline
    GCS["Google Cloud Storage (WAV)"]
    IngestionNode["Firebase Function: processAudioIngestion()"]
    CloudTasks["Google Cloud Tasks"]
    EngineDSP["Cloud Run: engine-dsp (Python/FastAPI)"]
    MagicBytes["validate_wav_magic_bytes (Partial Stream)"]
    Librosa["Librosa Profiling (OOM Safe)"]
    
    %% Orchestration Pipeline
    Toggle["Firebase Function: triggerUnifiedDistribution()"]
    CampaignFSM["CampaignFSM (Firestore)"]
    DDEX["DDEX Generator (compileDDEXRelease)"]
    PromiseAll["Promise.all (Concurrent DSP Dispatch)"]
    
    %% External Nodes
    Spotify["Spotify API"]
    AppleMusic["Apple Music API"]
    PRO["PRO Dispatch (BMI/ASCAP)"]
    
    %% Escrow Pipeline
    Webhook["Stripe Escrow Webhook"]
    HMAC["HMAC-SHA256 Validator"]
    ACID["Firestore ACID Transaction"]
    
    %% Links - Ingestion
    UserTrigger --> IngestionNode
    IngestionNode --> GCS
    IngestionNode --> CloudTasks
    CloudTasks --> EngineDSP
    EngineDSP --> MagicBytes
    MagicBytes --> Librosa
    
    %% Links - Distribution
    UserTrigger --> Toggle
    Toggle --> CampaignFSM
    Toggle --> DDEX
    DDEX --> PromiseAll
    PromiseAll --> Spotify
    PromiseAll --> AppleMusic
    PromiseAll --> PRO
    PromiseAll --> CampaignFSM
    
    %% Links - Escrow
    Webhook --> HMAC
    HMAC --> ACID
    
    %% Styling
    style UserTrigger fill:#00D4FF,stroke:#00acc1,stroke-width:2px,color:#000
    style IngestionNode fill:#8A2BE2,stroke:#4a148c,stroke-width:2px,color:#FFF
    style Toggle fill:#8A2BE2,stroke:#4a148c,stroke-width:2px,color:#FFF
    style EngineDSP fill:#39FF14,stroke:#1b5e20,stroke-width:2px,color:#000
    style CampaignFSM fill:#FF8C00,stroke:#e65100,stroke-width:2px,color:#000
    style ACID fill:#FF8C00,stroke:#e65100,stroke-width:2px,color:#000
    style Webhook fill:#FF00FF,stroke:#c51162,stroke-width:2px,color:#FFF
```

## Transition Breakdown

1. **Ingestion Flow**: The user uploads an audio asset. The `processAudioIngestion` Cloud Function securely queues the GCS path onto Cloud Tasks. The Python `engine-dsp` Cloud Run service retrieves the task, performs a memory-safe 12-byte stream to validate magic bytes (WAV/RIFF), and then runs `librosa` profiling.
2. **Distribution Flow**: The `triggerUnifiedDistribution` Cloud Function activates the `CampaignFSM` to `DISTRIBUTING`. It generates an ERN 4.2 DDEX payload via `compileDDEXRelease()`. Instead of sequential external calls, it fires `Promise.all()` to dispatch to Spotify, Apple Music, Tidal, and PROs concurrently, wrapped with an Exponential Backoff Circuit Breaker.
3. **Escrow Webhooks**: The `/escrow` webhook receives events from Stripe, validates the payload integrity using `crypto.createHmac`, and performs an ACID transaction against Firestore's `escrows` collection to prevent double-spending or replay attacks before releasing funds.
