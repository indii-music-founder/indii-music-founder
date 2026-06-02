# AI-Powered Sync Tagger & Pitch Agent Flowchart

This flowchart visualizes the `indii` automated sync pipeline. It maps the transition from a master audio upload, through Gemini's multimodal processing via Firebase Genkit, into final ID3 metadata tagging and background email dispatch.

```mermaid
graph TD
    %% Frontend Actions
    UploadDrop["Drag & Drop .wav File"] --> Zustand["Zustand: useSyncStore()"]
    Zustand --> UploadStorage["Firebase Storage: /masters/{uid}/"]
    
    %% AI Pipeline (Genkit)
    UploadStorage -- "File Uploaded" --> CloudFunction["Cloud Function: onFileWritten"]
    CloudFunction --> GenkitCore["Firebase Genkit: Audio Processing Flow"]
    GenkitCore --> GeminiModel["Gemini 3.1 Pro (Multimodal)"]
    
    %% Data Extraction & Tagging
    GeminiModel -- "Returns JSON (Mood, BPM, Instruments)" --> NodeTagger["Node.js: Inject ID3/WAV Headers"]
    NodeTagger --> FirestoreUpdate["Firestore: tracks/{trackId} (Save Metadata)"]
    
    %% Pitch Agent Dispatch
    FirestoreUpdate --> PitchAgent["Agent: Generate Pitch Template"]
    PitchAgent --> ApprovalGate{"User Approval via UI"}
    
    ApprovalGate -- "Approved" --> InngestQueue["Inngest: Background Job Queue"]
    InngestQueue --> SendGrid["SendGrid API (Email Supervisors)"]
    
    %% Styling Classes
    classDef ui fill:#e0f7fa,stroke:#00acc1,stroke-width:2px,color:#000
    classDef state fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#000
    classDef db fill:#fff3e0,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef api fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef ai fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000
    
    class UploadDrop,ApprovalGate ui
    class Zustand state
    class UploadStorage,FirestoreUpdate db
    class GenkitCore,GeminiModel,PitchAgent ai
    class CloudFunction,NodeTagger,InngestQueue,SendGrid api
```

## Transition Breakdown
1. **Trigger:** The artist drops a `.wav` file into the React UI, uploading it directly to a secure Firebase Storage bucket.
2. **AI Analysis:** The upload triggers a Firebase Cloud Function running Genkit. Genkit passes the audio buffer to the Gemini 3.1 Pro multimodal model, instructing it to output a strict JSON schema containing emotional intent, BPM, genres, and specific instrumentation.
3. **Metadata Injection:** A Node layer uses a utility to physically write the returned JSON metadata into the `.wav` ID3 headers. This makes the file inherently searchable by music supervisors on any platform.
4. **Agent Handoff:** The data saves to Firestore, triggering an AI Agent to draft a contextual pitch email for micro-sync libraries.
5. **Execution:** Once the artist clicks "Approve", the payload is handed to Inngest for reliable, queued background delivery via SendGrid.
