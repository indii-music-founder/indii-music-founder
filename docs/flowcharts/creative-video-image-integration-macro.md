# Creative Video & Image Integration Architecture

This flowchart maps the unified client-side and backend execution path for advanced video and image generation in the indii Creative Department.

## Macro-Level Architecture Flowchart

```mermaid
graph TD
    %% Inputs and State
    subgraph UI_Inputs ["Creative Studio Inputs"]
        P["User Prompt"]
        FF["First Frame Image"]
        LF["Last Frame Image / Interpolation Target"]
        RI["Reference Images / Style & Subject References"]
        W["Whisk Reference Mix: Subjects/Scenes/Styles/Motion"]
        GG["Google Location Grounding Toggle"]
    end

    %% State Handling
    subgraph Client_State ["Zustand State & Pre-processing"]
        CS["Creative Storage Service"]
        MG["Media Generator Client-Side SDK Path"]
        VS["Video Generation Service Gateway Path"]
        LI["Location Grounding Pre-flight"]
    end

    %% Routing
    FF -->|Upload Base64/Data URI| CS
    LF -->|Upload Base64/Data URI| CS
    RI -->|Upload Base64/Data URI| CS
    W -->|Select Checked Items| CS
    CS -->|Generate gs:// URIs| VS
    
    %% Grounding Path
    GG -->|Enabled| LI
    LI -->|1. Call Imagen 3 with Search Grounding| IM["Grounded Location Image"]
    IM -->|2. Upload to GCS| CS
    
    %% Video Service Routing
    P --> VS
    VS -->|Compacted Payload with gs:// URIs| CF["Firebase Function: generateVideoV3"]
    
    %% Direct SDK Path (Local / Dev)
    FF -.->|HTTP URL or Base64| MG
    MG -->|resolveImageInput: fetch & convert HTTP to Base64| SDK["Google Gen AI SDK client.models.generateVideos"]

    %% Backend Gateway
    subgraph Backend_Gateway ["Firebase Cloud Run v2"]
        CF -->|Submit job & poll operations| VEO["Vertex AI Veo 3.1 Model"]
        VEO -->|Poll operation status| J["Creative Jobs Firestore Node"]
    end

    %% Daisychain Engine
    subgraph Daisychain_Loop ["Daisychain Sequential Engine"]
        DC["Segment N Video URL"] -->|Extract Last Frame| FE["Frame Extractor"]
        FE -->|Data URL| GC["Gemini Temporal Context Analyzer"]
        GC -->|Continuity Prompt + Frame Bytes| SE["Segment N+1 Generation"]
    end
    
    VEO -.->|Long-form Split| Daisychain_Loop
```

## Step-by-Step Transition Breakdown
- **UI_Inputs to Client_State**: User options (prompt, references, framing targets) are processed by Zustand slices and pre-flight logic on the client.
- **Client_State to Backend_Gateway**: Reference media is uploaded to Cloud Storage to produce `gs://` URIs, which are sent in a compacted payload to `generateVideoV3`.
- **Backend_Gateway to Daisychain_Loop**: Long-form requests are segmented and run sequentially using frames extracted from previous blocks to maintain visual continuity.
