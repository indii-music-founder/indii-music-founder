# Backend-Only Security Boundary & API Dataflow Architecture

This flowchart maps the request routing, authentication gates, and execution environments that guarantee zero Google API keys are loaded or exposed on the client.

```mermaid
graph TD
    subgraph Client [Client: React SPA / Electron]
        UI[User UI Action] -->|Call Function| CF_Call[HTTPS Callable / SDK Client]
        UI -->|SSE Stream| SSE_Call[POST /api/agents/stream]
        CF_Call -.->|Firebase ID Token| AuthGate[Firebase Auth Gate]
        SSE_Call -.->|Firebase ID Token| AuthGate
    end

    subgraph Backend [Backend: Firebase Cloud Functions / Cloud Run]
        AuthGate -->|Token Verified| Handler[Request Handler]
        Handler -->|Verify App Check| AppCheck{App Check Token?}
        AppCheck -- Valid --> ExecHandler[Execute Business Logic]
        AppCheck -- Invalid/Dev Bypass --> ExecHandler
        
        ExecHandler -->|Lazy Load SDK| VertexClient[VertexClient.ts getVertexAIClient]
        VertexClient -->|Read ADC Credentials| ADC[Application Default Credentials]
    end

    subgraph GCP [Google Cloud Platform / Vertex AI API]
        ADC -->|Service Account Token| VertexAPI[Vertex AI / Gemini API Endpoints]
        ADC -->|Service Account Token| GCS[Google Cloud Storage Bucket]
        ADC -->|Service Account Token| Firestore[Firestore Database]
    end

    classDef clientStyle fill:#e6f7ff,stroke:#1890ff,stroke-width:2px;
    classDef backendStyle fill:#f6ffed,stroke:#52c41a,stroke-width:2px;
    classDef gcpStyle fill:#fff7e6,stroke:#ffa940,stroke-width:2px;
    
    class UI,CF_Call,SSE_Call clientStyle;
    class Handler,AppCheck,ExecHandler,VertexClient,ADC backendStyle;
    class VertexAPI,GCS,Firestore gcpStyle;
```

## Detailed Transition Breakdown

1. **Request Initiation (Client):** The client (React SPA or Electron shell) initiates an AI or storage operation. Instead of making raw Google REST API requests directly, it calls server-side Firebase HTTPS Callable functions or sends POST requests to stream endpoints.
2. **Authentication Gate:** The client request includes the user's Firebase ID token. The backend verifies the token to establish user identity.
3. **App Check Validation:** The request passes through Firebase App Check to verify that it originates from an authentic client application rather than an automated script or unauthorized third-party site.
4. **Lazy Initialization of Vertex Client:** The backend handler lazily initializes the `GoogleGenAI` client using Application Default Credentials (ADC). No API keys are passed or stored in configuration files.
5. **GCP Service Execution:** The authenticated service account requests resources from Vertex AI, Cloud Storage, or Firestore on behalf of the user, returning the results securely back to the client.
