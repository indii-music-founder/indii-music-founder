# API Secret Architecture & UI Caching

This flowchart maps the architecture of the indii.music platform regarding Secret Management, Progressive Web App (PWA) UI caching, and backend API integration. It specifically illustrates the incident where exposed keys were automatically revoked by Google Trust & Safety, and how the caching layer served the older "purple" UI to the founder.

```mermaid
graph TD
    %% System Layers & User Inputs
    User["indii.music Founder"]
    GitHub["GitHub Secrets (CI/CD Pipeline)"]
    EnvLocal["Local .env File (Exposed Logs)"]
    
    %% Hosting & Caching Layer
    subgraph "Client & Hosting Layer"
        PWA["PWA Service Worker (Cache)"]
        Browser["Chrome Browser"]
        HostLanding["Firebase Hosting (indii-music-founder)"]
        HostApp["Firebase Hosting (indii-music-studio)"]
    end
    
    %% Backend & Security Layer
    subgraph "Backend & Security"
        SecretManager["Google Cloud Secret Manager"]
        TrustSafety["Google Trust & Safety Scanner"]
        FirebaseFunc["Firebase Functions (Gen 2 - 512MB RAM)"]
    end
    
    %% External APIs
    subgraph "External APIs"
        GeminiAPI["Gemini AI API"]
        MapsAPI["Google Maps API"]
    end
    
    %% Relationships: UI & Caching
    User -->|"Visits .web.app"| PWA
    PWA -->|"Serves Stale Purple App"| Browser
    User -->|"Cmd+Shift+R (Hard Refresh)"| Browser
    Browser -->|"Bypasses Cache & Fetches Green App"| HostApp
    
    %% Relationships: Secrets & Revocation
    User -->|"Updates (NEW_API_KEYS_DO_NOT_SHARE)"| GitHub
    User -->|"Updates locally"| EnvLocal
    GitHub -->|"Injects Keys during deploy"| SecretManager
    SecretManager -->|"Securely mounts keys at runtime"| FirebaseFunc
    
    TrustSafety -.->|"Detects exposed keys in logs"| EnvLocal
    TrustSafety --x|"INSTANTLY REVOKES"| GeminiAPI
    TrustSafety --x|"INSTANTLY REVOKES"| MapsAPI
    
    FirebaseFunc -->|"Fails if keys revoked or OOM"| GeminiAPI
    FirebaseFunc -->|"Fails if keys revoked"| MapsAPI
    
    %% Styling
    style User fill:#e0f7fa,stroke:#00acc1,stroke-width:2px
    style GitHub fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    style EnvLocal fill:#ffebee,stroke:#c62828,stroke-width:2px
    
    style PWA fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style Browser fill:#e0f7fa,stroke:#00acc1,stroke-width:2px
    style HostLanding fill:#fff8e1,stroke:#ff8f00,stroke-width:2px
    style HostApp fill:#fff8e1,stroke:#ff8f00,stroke-width:2px
    
    style SecretManager fill:#efebe9,stroke:#6d4c41,stroke-width:2px
    style TrustSafety fill:#ffebee,stroke:#c62828,stroke-width:3px,color:#c62828
    style FirebaseFunc fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    
    style GeminiAPI fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style MapsAPI fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
```

## Transition Breakdown

1. **The PWA Caching Illusion:** 
   When the user visits `indii-music-studio.web.app`, the `PWA Service Worker` intercepts the request. Because the user had previously "installed" the old purple version (indiiOS), the Service Worker serves the cached assets directly to the `Chrome Browser` without hitting the live servers. A Hard Refresh (`Cmd+Shift+R`) forces the browser to bypass the `PWA Service Worker` and fetch the latest green release from `Firebase Hosting`.

2. **The Exposed Secret Incident:**
   The `Local .env File` was read by the AI agent, causing the API keys to be printed in plain text within the chat interface.

3. **Google Trust & Safety Intervention:**
   The `Google Trust & Safety Scanner` monitors platforms for leaked credentials. Upon detecting the Gemini and Maps keys, it executed an emergency protocol, instantly revoking the keys on the `Gemini AI API` and `Google Maps API` endpoints to prevent malicious abuse.

4. **Cascading Backend Failure:**
   The `Firebase Functions` attempted to process user requests (like generating images or resolving addresses). Because the keys were revoked, the external APIs threw `403 Forbidden` and `400 Invalid API Key` errors. Concurrently, heavy AI operations hit the default `256MB` RAM limit, causing Out-Of-Memory (OOM) crashes.

5. **The Resolution Pipeline:**
   New keys are generated and given to the `indii.music Founder` (via the `NEW_API_KEYS_DO_NOT_SHARE.txt` file). The founder updates `GitHub Secrets`. The CI/CD pipeline deploys these fresh keys securely into the `Google Cloud Secret Manager`. Finally, the upgraded `Firebase Functions (Gen 2 - 512MB RAM)` securely mounts the new keys at runtime and successfully connects to the external APIs.
