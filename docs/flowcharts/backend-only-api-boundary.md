# Backend-Only Security Boundary & API Dataflow Architecture

This flowchart maps the request routing, authentication gates, and execution environments that guarantee zero Google API keys are loaded or exposed on the client.

```mermaid
graph TD
    subgraph Client ["🖥️ CLIENT LAYER (React SPA / Electron)"]
        UI["User UI Interaction Trigger"] -->|Call Function| CF_Call["HTTPS Callable SDK Client"]
        UI -->|SSE Stream| SSE_Call["POST /api/agents/stream"]
        CF_Call -.->|Firebase ID Token| AuthGate["Firebase Auth Gateway"]
        SSE_Call -.->|Firebase ID Token| AuthGate
    end

    subgraph Backend ["⚙️ BACKEND SERVICES (Firebase Cloud Functions)"]
        AuthGate -->|1. Token Verified| Handler["Secure Request Handler"]
        Handler -->|2. Verify App Check| AppCheck{"App Check Token?"}
        AppCheck -- Valid Client --> ExecHandler["Execute Business Logic"]
        AppCheck -- Invalid/Dev Bypass --> ExecHandler
        
        ExecHandler -->|3. Lazy Load SDK| VertexClient["VertexClient.ts getVertexAIClient()"]
        VertexClient -->|4. Resolve Auth| ADC["Application Default Credentials (ADC)"]
    end

    subgraph GCP ["☁️ SECURE CLOUD ENVIRONMENT (GCP / Vertex AI API)"]
        ADC -->|5. Service Account Token| VertexAPI["Vertex AI / Gemini API Endpoints"]
        ADC -->|5. Service Account Token| GCS["Google Cloud Storage Bucket"]
        ADC -->|5. Service Account Token| Firestore["Firestore Database"]
    end

    %% Premium Investor-ready HSL Color Styling
    classDef clientStyle fill:#0F172A,stroke:#00D4FF,stroke-width:2px,color:#F8FAFC;
    classDef backendStyle fill:#1E1B4B,stroke:#D946EF,stroke-width:2px,color:#F8FAFC;
    classDef gcpStyle fill:#1C1917,stroke:#FB923C,stroke-width:2px,color:#F8FAFC;
    
    class UI,CF_Call,SSE_Call,AuthGate clientStyle;
    class Handler,AppCheck,ExecHandler,VertexClient,ADC backendStyle;
    class VertexAPI,GCS,Firestore gcpStyle;
```

## Detailed Transition Breakdown

1. **Request Initiation (Client):** The client (React SPA or Electron shell) initiates an AI or storage operation. Instead of making raw Google REST API requests directly, it calls server-side Firebase HTTPS Callable functions or sends POST requests to stream endpoints.
2. **Authentication Gate:** The client request includes the user's Firebase ID token. The backend verifies the token to establish user identity.
3. **App Check Validation:** The request passes through Firebase App Check to verify that it originates from an authentic client application rather than an automated script or unauthorized third-party site.
4. **Lazy Initialization of Vertex Client:** The backend handler lazily initializes the `GoogleGenAI` client using Application Default Credentials (ADC). No API keys are passed or stored in configuration files.
5. **GCP Service Execution:** The authenticated service account requests resources from Vertex AI, Cloud Storage, or Firestore on behalf of the user, returning the results securely back to the client.

