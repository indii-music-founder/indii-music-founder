# Creative Studio Architecture & Backend Boundary Flowchart

This flowchart visualizes the strict API security boundary enforced within the indii-music-founder platform, specifically mapping out the Creative Studio (Infinite Canvas) tools we just updated. It proves that **zero API secrets or direct third-party routing** exist in the frontend Vite application. All requests securely route through the Firebase Functions emulator/production environment.

```mermaid
graph TD
    %% Styling Classes
    classDef ui fill:#00D4FF,stroke:#00acc1,stroke-width:2px,color:#000
    classDef logic fill:#8A2BE2,stroke:#5e35b1,stroke-width:2px,color:#fff
    classDef data fill:#FF8C00,stroke:#f57c00,stroke-width:2px,color:#fff
    classDef cloud fill:#39FF14,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef security fill:#FF00FF,stroke:#c2185b,stroke-width:2px,color:#fff

    %% User Layer
    User["indii Founder (Browser / iPad)"]:::ui

    %% Frontend Components (Vite/React)
    subgraph Frontend ["Frontend App (Strictly UI / No External APIs)"]
        Canvas["InfiniteCanvas.tsx"]:::ui
        HUD["InfiniteCanvasHUD.tsx"]:::ui
        Zoom["Zoom Controls (Local)"]:::ui
        GenTools["Generation & Crop Overlays"]:::ui
        LayerTools["Detect Objects & Layers (Placeholders)"]:::ui
        
        Canvas --> HUD
        HUD --> Zoom
        HUD --> GenTools
        HUD --> LayerTools
    end

    %% Firebase Auth / App Check
    subgraph SecurityGate ["Firebase Client SDK (Auth & App Check)"]
        TokenAuth["ID Token (auth.currentUser)"]:::security
        AppCheck["App Check Token"]:::security
    end

    %% Backend Boundary (Firebase Functions)
    subgraph Backend ["Backend Boundary (Firebase Functions: port 5001)"]
        Validation["Endpoint Validation (Verify Tokens)"]:::logic
        ImageGenService["Creative/ImageGenerationService"]:::logic
        EditingService["Creative/EditingService"]:::logic
        AudioService["Creative/AudioAnalyzerService"]:::logic
    end

    %% External GCP APIs (Secrets Layer)
    subgraph GCP ["External APIs (Google Cloud / Vertex AI)"]
        SecretManager["GC Secret Manager (ADC Credentials)"]:::data
        Imagen["Vertex AI (Imagen 3)"]:::cloud
        Veo["Veo 3.1 Video Gen"]:::cloud
    end

    %% Connections
    User --> Canvas
    
    %% Local actions
    Zoom -.-> Canvas
    LayerTools -.-> |"Coming Soon Toast"| HUD

    %% The Secure Transition
    GenTools --> |"Trigger action"| TokenAuth
    GenTools --> |"Trigger action"| AppCheck
    
    TokenAuth --> |"HTTPS Callable / fetch POST"| Validation
    AppCheck --> |"HTTPS Callable / fetch POST"| Validation
    
    Validation --> ImageGenService
    Validation --> EditingService
    Validation --> AudioService

    ImageGenService --> SecretManager
    EditingService --> SecretManager
    AudioService --> SecretManager
    
    SecretManager --> Imagen
    SecretManager --> Veo
    
    Imagen --> |"Secure Output Stream"| ImageGenService
    ImageGenService --> |"Sanitized Response"| GenTools
```

## Step-by-Step Transition Breakdown

1. **User Action:** The user interacts with the `InfiniteCanvasHUD` tools inside `InfiniteCanvas.tsx` (e.g., triggering an Image Generation prompt or cropping).
2. **Local Processing vs. Remote Trigger:** 
   - Operations like **Zoom** modify the `scaleRef` state locally and trigger an immediate re-render (`requestDraw()`). 
   - Unimplemented features like **Layers** and **Detect Objects** trigger honest "Coming Soon" tooltips directly in the UI.
   - Remote actions like **Generate** or **Flatten** bundle up the request payload.
3. **Security Handshake:** The frontend strictly requests a fresh ID Token (`auth.currentUser.getIdToken()`) and App Check attestation token from the Firebase Client SDK.
4. **Boundary Transition:** The frontend performs an HTTPS Callable or `fetch` request to the Firebase Functions emulator (`localhost:5001`), attaching the secure tokens in the headers. *No external API keys (e.g., Vertex AI, Gemini) are exposed or sent.*
5. **Backend Validation:** The Firebase Function verifies the ID Token and App Check token. If unauthorized, it rejects the request instantly (`403 Forbidden` / `401 Unauthorized`).
6. **Credential Injection:** The verified Cloud Function uses Google Application Default Credentials (ADC) or queries Google Cloud Secret Manager to safely inject the hidden server-side keys.
7. **External API Execution:** The function talks directly to the Vertex AI APIs (Imagen 3, Veo 3.1) executing the complex generation pipelines securely on Google Cloud.
8. **Sanitized Response:** The backend receives the raw payload, scrubs any server metadata, and securely returns the clean base64 image or SSE stream back to the React client to render for the user.
