# Electron CSP & Firebase App Check Security Integration Flowchart

This flowchart visualizes the complete end-to-end security architecture implemented for **indii Studio** on Electron. It maps how runtime web requests are protected by Content Security Policy (CSP) headers, how Firebase App Check performs dynamic client validation using Google reCAPTCHA, and how local/remote database reads/writes are authenticated and validated.

```mermaid
graph TD
    %% Node Definitions
    subgraph UI ["Electron Renderer Layer"]
        UserAction["User Interaction (Login / Query)"]
        ReactApp["React / TS Studio App"]
        AppCheckSDK["Firebase App Check SDK"]
        ReCaptchaWidget["reCAPTCHA v3 Widget (Iframe)"]
        IntelligenceService["FirebaseIntelligenceService (Local Override)"]
    end

    subgraph Core ["Electron Main Process (Security Gate)"]
        MainProcess["main.ts (IPC Router)"]
        CSPEnforcer["security/index.ts (CSP Listener)"]
        SessionHook["onHeadersReceived"]
        RefererInjector["onBeforeSendHeaders"]
    end

    subgraph FirebaseCloud ["Firebase & Google Cloud Platform"]
        GCPRecaptcha["Google reCAPTCHA API"]
        AppCheckService["Firebase App Check Token Exchange"]
        EnvConfig["Environment Config (.env / NODE_ENV)"]
        GatewayRouter["Gateway Cloud Function (gateway.ts)"]
        FirestoreDB["Cloud Firestore (Security Rules)"]
    end

    %% Flow Connections
    UserAction -->|1. Render Request| ReactApp
    ReactApp -->|2. Request Header Capture| SessionHook
    SessionHook -->|3. Evaluate & Enforce CSP Rules| CSPEnforcer
    
    %% App Check & reCAPTCHA Validation
    ReactApp -->|4. Initialize App Check| AppCheckSDK
    AppCheckSDK -->|5. Load Script (If Prod)| ReCaptchaWidget
    ReCaptchaWidget -->|6. Challenge Verification| GCPRecaptcha
    GCPRecaptcha -->|7. Return Token| AppCheckSDK
    AppCheckSDK -->|8. Exchange Token| AppCheckService
    AppCheckService -->|9. Issue Attestation| AppCheckSDK

    %% App Check Dev Bypass (The Fix)
    ReactApp -->|10. Calls AI/Generators| IntelligenceService
    IntelligenceService -.->|"Bypasses local failures"| GatewayRouter
    EnvConfig -.->|"Sets ENFORCE_APP_CHECK=false"| GatewayRouter
    GatewayRouter -->|11. Allows Local Dev Access| FirestoreDB

    %% Connect & Injector Rules
    ReactApp -->|12. Query Firestore Collection| RefererInjector
    RefererInjector -->|13. Inject Localhost Referer Header| FirestoreDB
    AppCheckSDK -.->|14. Attach Attestation (If Enforced)| FirestoreDB
    FirestoreDB -->|15. Enforce Security Rules| FirestoreDB
    FirestoreDB -->|16. Return Authorized Data| ReactApp

    %% Styling and Class Specifications
    classDef ui fill:#00D4FF,stroke:#005c8a,stroke-width:2px,color:#000000;
    classDef core fill:#8A2BE2,stroke:#4b0082,stroke-width:2px,color:#ffffff;
    classDef cloud fill:#FF8C00,stroke:#8b4500,stroke-width:2px,color:#ffffff;
    classDef recaptcha fill:#39FF14,stroke:#008b00,stroke-width:2px,color:#000000;
    classDef bypass fill:#FF00FF,stroke:#8b008b,stroke-width:2px,color:#ffffff;

    class UserAction,ReactApp,AppCheckSDK,IntelligenceService ui;
    class MainProcess,CSPEnforcer,SessionHook,RefererInjector core;
    class AppCheckService,FirestoreDB,GatewayRouter cloud;
    class ReCaptchaWidget,GCPRecaptcha recaptcha;
    class EnvConfig bypass;
```

## Detailed Transition Walkthrough

1. **Session Initialization & CSP Application**:
   * When a user performs an interaction inside **React / TS Studio App** (`ReactApp`), Electron's main process intercepts runtime web headers via `session.webRequest.onHeadersReceived` (`SessionHook`).
   * The security engine (`CSPEnforcer` inside `packages/main/src/security/index.ts`) injects a production-hardened `Content-Security-Policy` header.

2. **App Check & reCAPTCHA Flow (Production)**:
   * During boot, the `AppCheckSDK` initializes App Check dynamically.
   * It mounts the reCAPTCHA v3 widget (`ReCaptchaWidget`) which performs dynamic challenge-response evaluations directly against the Google reCAPTCHA endpoints (`GCPRecaptcha`).
   * The reCAPTCHA API returns a challenge token to the client SDK, which is exchanged with the remote `AppCheckService` to obtain a cryptographically signed App Check Attestation Token.

3. **Local Dev Bypass (The Stabilization Fix)**:
   * **The Problem:** The local development environment was completely locked out of Vertex AI and Firestore because reCAPTCHA cannot reliably run in `localhost:4242` Electron contexts without strict registry entries.
   * **The Fix:** The `FirebaseIntelligenceService` on the frontend is configured to safely swallow App Check errors locally, allowing the AI requests to pass to the backend. The backend `GatewayRouter` (`gateway.ts` / `manageSemanticMemory.ts`) explicitly checks `NODE_ENV` and `SKIP_APP_CHECK` via the `EnvConfig`. 
   * **Result:** If `NODE_ENV !== 'production'`, `ENFORCE_APP_CHECK` disables the middleware rejection, allowing the founder to generate images, run the audio analyzer, and access Vertex AI models without being 401 Unauthorized blocked.

4. **Firestore Interaction with Referer Injection**:
   * The React app issues queries to read or write data inside `FirestoreDB`.
   * Electron's main process intercepts all standard outbound Google API requests via `onBeforeSendHeaders` (`RefererInjector`).
   * For security matching, the injector attaches the required verification header (`Referer: http://localhost:4242`) directly to the request before it leaves the client machine.
   * Firestore validates the combined payload, returning authorized data safely to the user's dashboard interface.

## 2026-06-20 Correction — Production Web Path & Enforcement Reality

This chart was Electron/localhost-centric and under-documented the **production web** (`indii.music`) AI path. Corrections from a real outage:

1. **The Boardroom Conductor's backend is `generateContentStream`** (an `onRequest` HTTP function in `packages/firebase/src/index.ts`), reached via `FirebaseIntelligenceService.getBackendStreamUrl()` → `https://us-central1-<project>.cloudfunctions.net/generateContentStream`. It is **not** the `gateway.ts` callable shown above. App Check is verified **manually** inside the handler (`if (ENFORCE_APP_CHECK) { admin.appCheck().verifyToken(...) }`), guarded so the CORS preflight can still pass.
2. **Enforcement is env-driven, and the prod default must be ON.** `ENFORCE_APP_CHECK = process.env.SKIP_APP_CHECK !== 'true' && process.env.ENFORCE_APP_CHECK !== 'false'`. A regression once hardcoded this to `false` ("temporarily disabled for migration testing"), silently bypassing App Check on ~30 functions in production — a violation of this chart's intent. Bypass belongs in dev only (`SKIP_APP_CHECK=true` in local/CI env), never as a committed constant.
3. **Cold-start hazard (the actual outage cause):** `agentLoopCron.ts` imported the unbundled monorepo workspace package `@indii/shared` at module top-level. Because `index.ts` loads it, every function (including `generateContentStream`) crashed cold-start with `Cannot find module '@indii/shared'`, leaving a stale App-Check-enforcing revision live and returning misleading `401 Missing App Check token`. Never import unbundled `@indii/*` workspace packages at the top level of deployed function code. See ERROR_LEDGER 2026-06-20.
