# Direct Image Generation Vertex AI Architecture

This flowchart maps the dynamic client-to-backend image generation routing introduced to eliminate client-side key exposures and resolve AI Studio free-tier rate limits/quotas.

```mermaid
graph TD
    %% Define Styles
    classDef client fill:#3b82f6,stroke:#1d4ed8,stroke-width:2px,color:#fff;
    classDef backend fill:#8b5cf6,stroke:#6d28d9,stroke-width:2px,color:#fff;
    classDef external fill:#10b981,stroke:#047857,stroke-width:2px,color:#fff;

    %% Client Operations
    subgraph Client UI [React Creative Studio Client]
        A["User Inputs Prompt"] --> B["useDirectGeneration Hook"]
        B --> C["generateImageDirectly Proxy Method"]
        C --> D["firebase.functions.httpsCallable('generateImageV3')"]
    end
    class A,B,C,D client;

    %% Cloud Function Security Proxy
    subgraph CloudFunction [Firebase Cloud Function v2]
        D --> E["enforceRateLimit Check"]
        E --> F["Zod Payload Validation"]
        F --> G["GeminiImageService.generate()"]
        G --> H{"Is Local/Test?"}
    end
    class E,F,G,H backend;

    %% Local Fallback (Google AI Studio)
    subgraph AIStudio [Google AI Studio (Local Development/Tests)]
        H -- Yes --> I["Load API Key via getGeminiApiKey()"]
        I --> J["new GoogleGenAI({ apiKey }) Client"]
        J --> K["Call AI Studio API"]
    end
    class I,J,K external;

    %% Production Route (GCP Vertex AI)
    subgraph VertexAI [GCP Vertex AI (Production Cloud Functions)]
        H -- No --> L["Access Cloud Function ADC credentials"]
        L --> M["new GoogleGenAI({ vertexai: true, project, location })"]
        M --> N["Call GCP Vertex AI Endpoint"]
    end
    class L,M,N external;

    %% Consolidation
    K --> O["Parse Multimodal responseModalities: ['IMAGE']"]
    N --> O
    O --> P["Extract inline Base64 Image bytes"]
    P --> Q["Return standard Data URI to Client"]
    Q --> R["Render Canvas Layer in Fabric.js"]
    class O,P,Q backend;
    class R client;
```

## Transition Breakdown

### 1. Client Trigger to Function Proxy
The React client captures the prompt and optional configurations (like aspect ratio) and packages them into a standard JSON payload. Instead of directly calling Google APIs using raw API keys exposed in client bundles, it utilizes Firebase's secure `httpsCallable` interface to request execution by the authenticated `generateImageV3` Cloud Function.

### 2. Validation & Security Gates
Upon receiving the call, the Cloud Function runs two deterministic middleware checks:
- **Rate Limiting:** Enforces a maximum rate of 10 generation calls per user per minute using a transaction-locked Firestore sliding-window registry.
- **Input Validation:** Parses and filters request parameters against `GenerateImageRequestSchema` using Zod, ensuring safe execution bounds.

### 3. Smart Client Environment Routing
`GeminiImageService` determines its execution context:
- If running under `vitest` or the local emulator, it retrieves the developer's `GEMINI_API_KEY` from environment variables and constructs a standard Google AI Studio client.
- If running in production GCP environments, it dynamically activates the **Vertex AI** integration. By enabling `vertexai: true` and pointing to the active GCP Project, it inherits the Cloud Function's **Application Default Credentials (ADC)**, securely bypassing all external API key allocations, rotations, and free-tier quotas.

### 4. Multimodal Generation & Client Handoff
Both pipelines resolve calls using the unified `@google/genai` interface. It specifies `responseModalities: ["IMAGE"]` using stable `gemini-3.1-flash-image` and `gemini-3-pro-image-preview` endpoints. The returned base64-encoded image payload is mapped to a secure `data:` URI and returned to the React frontend, where Fabric.js decodes it off-thread to render the visual assets seamlessly.
