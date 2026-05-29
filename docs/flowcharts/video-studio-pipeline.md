# Video Studio & Director's Cut Pipeline Flowchart

This flowchart maps the technical and procedural lifecycle of video generation within indii. From ideation in the Screenwriter module to rendering via Google's Veo 3.1 model on Vertex AI, it details the async queuing system required for long-running video generation.

```mermaid
graph TD
    %% UI & Pre-Production
    subgraph PreProduction ["Pre-Production (Frontend)"]
        Screenwriter["Screenwriter / Brief Module"]
        PromptEngine["indii Cinema Worldbuilder (Prompt Construction)"]
        Preview["Director's Cut (QA / Storyboard Review)"]
    end

    %% State & Services
    subgraph ClientLayer ["Client State & API"]
        VideoSlice["Zustand `videoSlice`"]
        VideoService["VideoService (Async Poller)"]
    end

    %% Cloud Infrastructure (Backend)
    subgraph Backend ["Firebase Cloud Functions (Backend)"]
        InitJob["`generateVideo` (HTTPS Trigger)"]
        AuthGate["Tier Verification Gate"]
        TaskQueue["Cloud Tasks / Inngest Queue"]
        StatusWebhook["`videoStatusWebhook`"]
    end

    %% Model & Storage
    subgraph Execution ["Vertex AI & Storage"]
        Veo["Vertex AI (`veo-3.1-generate-preview`)"]
        Firestore["Firestore Database (`jobs` collection)"]
        Storage["Firebase Cloud Storage (`gs://`)"]
    end

    %% Flow Connections
    Screenwriter -->|"Inputs idea / script"| PromptEngine
    PromptEngine -->|"Formats strictly to Veo syntax"| Preview
    Preview -->|"User Approves Prompts"| VideoSlice
    
    VideoSlice -->|"Dispatches Render Request"| VideoService
    VideoService -->|"Sends Initial Payload"| InitJob
    
    InitJob -->|"Checks Max Duration Tier"| AuthGate
    AuthGate -->|"Pass"| TaskQueue
    
    TaskQueue -->|"Creates Job ID & Dispatches"| Veo
    TaskQueue -->|"Writes Pending State"| Firestore
    
    InitJob -->|"Returns Job ID (202 Accepted)"| VideoService
    VideoService -.->|"Polls `jobs/{id}` periodically"| Firestore
    
    Veo -->|"Renders Video (Long-running)"| Storage
    Veo -->|"Triggers Completion Webhook"| StatusWebhook
    StatusWebhook -->|"Updates `jobs/{id}` to DONE"| Firestore
    
    VideoService -->|"Detects DONE Status"| VideoSlice
    VideoSlice -->|"Renders Final Video Player"| Preview

    %% Styling
    style Screenwriter fill:#00D4FF,color:#000
    style PromptEngine fill:#00D4FF,color:#000
    style Preview fill:#00D4FF,color:#000

    style VideoSlice fill:#8A2BE2,color:#FFF
    style VideoService fill:#8A2BE2,color:#FFF

    style InitJob fill:#FF8C00,color:#000
    style TaskQueue fill:#FF8C00,color:#000
    style StatusWebhook fill:#FF8C00,color:#000
    style AuthGate fill:#FF00FF,color:#FFF

    style Veo fill:#39FF14,color:#000
    style Firestore fill:#39FF14,color:#000
    style Storage fill:#39FF14,color:#000
```

## Transition Breakdown

1. **Pre-Production:** The user enters a script or concept into the **Screenwriter** module.
2. **Prompt Engineering:** The **indii Cinema Worldbuilder** kicks in (either locally or via `CreativeDirectorAgent`) to expand the brief into highly specific cinematography language (lens type, motion, lighting) optimized strictly for the Veo model.
3. **Director's Cut (QA):** Before rendering, the user reviews the locked-in prompts in the **Director's Cut** UI. Once approved, the state updates the **Zustand `videoSlice`**.
4. **Initiating the Render:** Video generation is slow. The client's **VideoService** sends an HTTPS request to the **`generateVideo`** Cloud Function.
5. **Auth & Queueing:** The backend checks the **Tier Verification Gate** (e.g., verifying if the Free user has exceeded their 8-minute/day limit). If approved, it does *not* wait for Vertex AI to finish. It enqueues the request in **Cloud Tasks** (or Inngest) and immediately writes a `status: PENDING` record to the **Firestore** `jobs` collection. 
6. **Async Client Polling:** The Cloud Function returns a HTTP 202 Accepted with the `JobID`. The frontend **VideoService** begins silently polling that Firestore document to check its status.
7. **Execution:** The backend worker sends the payload to **Vertex AI (`veo-3.1-generate-preview`)**. 
8. **Fulfillment:** When Vertex AI finishes rendering, it saves the mp4 to **Firebase Cloud Storage**. A completion webhook triggers **`videoStatusWebhook`**, which updates the Firestore document status to `DONE` and attaches the final video URL.
9. **UI Update:** The frontend polling detects the `DONE` state, stops polling, updates the **VideoSlice**, and transitions the user from a loading state to a fully playable video.
