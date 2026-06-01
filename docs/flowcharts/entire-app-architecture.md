# Entire App Architecture Flowchart

This macro flowchart depicts the high-level system architecture of **indii** — the AI-native music business platform. It maps the interaction between client interfaces, the frontend orchestration layer (**indii Conductor** + A2A swarm), the **Deterministic Business Harness Engine**, the Firebase Gen 2 backend, the Genkit generative stack, and external integrations.

```mermaid
graph TD
    %% ===== Client Interface Layer =====
    subgraph Client ["Client Interfaces"]
        LP["Landing Page (packages/landing)"]
        SA["Studio Web App (packages/renderer)"]
        ED["Electron Desktop Shell (packages/main)"]
        MR["indiiREMOTE (mobile-remote module)"]
    end

    %% ===== State & Orchestration Layer =====
    subgraph Orchestration ["State & Orchestration (Frontend)"]
        ZS["Zustand Global Store (10 domain slices)"]
        COND["indii Conductor — AgentGraphService (DAG Runner)"]
        AGS["AgentService (Execution Engine)"]
        A2A["A2AClient (Peer-to-Peer Delegation)"]
        REG["Agent Registry (capability_registry.json)"]
    end

    %% ===== Deterministic Business Harness Layer (NEW) =====
    subgraph Harness ["Business Harness Engine (Deterministic State)"]
        MCP["indii-harness (MCP Server)"]
        COMP["HarnessCompilers (22 Domains)"]
        RUN["HarnessRun (Normalized State Packet + Gates)"]
        BMH["Boardroom Meta-Harness (Reconciler)"]
    end

    %% ===== Specialist Swarm Layer =====
    subgraph Swarm ["Decentralized A2A Specialist Swarm (Probabilistic)"]
        LEGAL["Legal"]
        MKT["Marketing"]
        BRAND["Brand"]
        CRE["Creative"]
        FIN["Finance"]
        MUS["Music"]
        DIST["Distribution"]
        PUB["Publishing"]
        OTHER["...and 7 other Specialists"]
    end

    %% ===== Backend / Cloud Layer =====
    subgraph Cloud ["Backend Infrastructure (Firebase Gen 2)"]
        CF["Cloud Functions (Node 22, Gen 2)"]
        FS["Firestore (Security Rules)"]
        CS["Cloud Storage (Storage Rules)"]
        BQ["BigQuery (Revenue Analytics)"]
        INNG["Inngest (Background Jobs)"]
    end

    %% ===== AI / Generative Layer =====
    subgraph AI ["Generative AI (Genkit 1.26 + Vertex AI)"]
        GTEXT["Gemini 3.1 Pro / Flash-Lite"]
        GIMG["Gemini 3 Pro Image (Nano Banana)"]
        GTTS["Gemini 2.5 Pro TTS"]
        VEO["Veo 3.1 (Video Generation)"]
        RAG["Gemini File Search (Memory)"]
    end

    %% ===== External Integrations =====
    subgraph External ["External Integrations"]
        DSP["Distributors (SFTP, DDEX)"]
        MAPS["Google Maps (Touring)"]
        GH["GitHub (Bug Reports / CI)"]
    end

    %% ===== Transitions =====
    LP -->|"auth bridge handoff"| SA
    ED --> SA
    MR -->|"WebSocket control"| SA
    SA --> ZS
    ZS --> COND
    COND --> AGS
    COND --> REG
    AGS --> A2A
    A2A -->|"consult_specialist"| Swarm
    
    %% Harness Flow
    Swarm -->|"MCP Tool Calls (compile_harness)"| MCP
    MCP --> COMP
    COMP -->|"Generates with strict Approval Gates"| RUN
    RUN -->|"Persisted"| FS
    Swarm -->|"MCP Tool Calls (create_boardroom_decision)"| BMH
    RUN -->|"Ingested by"| BMH
    BMH -->|"Returns BoardroomHarnessDecision"| Swarm

    AGS --> AI
    Swarm --> CF
    CF --> FS
    CF --> CS
    CF --> BQ
    CF --> INNG
    CF --> AI
    CF --> External
    AI --> RAG
    RAG --> FS

    %% ===== Styling =====
    classDef ui fill:#00D4FF,stroke:#0077AA,stroke-width:2px,color:#001018;
    classDef logic fill:#8A2BE2,stroke:#5500AA,stroke-width:2px,color:#FFFFFF;
    classDef harness fill:#FF00FF,stroke:#AA00AA,stroke-width:2px,color:#FFFFFF;
    classDef data fill:#FF8C00,stroke:#AA5500,stroke-width:2px,color:#001018;
    classDef ai fill:#39FF14,stroke:#1A8800,stroke-width:2px,color:#001018;
    classDef ext fill:#FF3333,stroke:#AA0000,stroke-width:2px,color:#FFFFFF;

    class LP,SA,ED,MR ui;
    class ZS,COND,AGS,A2A,REG logic;
    class MCP,COMP,RUN,BMH harness;
    class LEGAL,MKT,BRAND,CRE,FIN,MUS,DIST,PUB,OTHER logic;
    class CF,FS,CS,BQ,INNG data;
    class GTEXT,GIMG,GTTS,VEO,RAG ai;
    class DSP,MAPS,GH ext;
```

## Transition Breakdown (Updated)

1. **Entry & Auth (Client → State):** A user enters via Landing, Studio Web App, Desktop Shell, or indiiREMOTE. All client surfaces hydrate the **Zustand Global Store**.
2. **Orchestration Dispatch (State → Conductor):** A user request flows into the **indii Conductor** (AgentGraphService). The Conductor queries the Agent Registry before planning execution graphs.
3. **Delegation (Conductor → Specialist Swarm → A2AClient):** Conductor orchestrates specialist agents via AgentRegistry, utilizing A2AClient to dispatch P2P requests with scope-guards.
4. **Deterministic Harness Generation (Swarm → Harness Engine):** *[NEW]* Probabilistic Swarm Agents DO NOT invent execution readiness. They invoke the **`indii-harness` MCP Server**, executing deterministic **HarnessCompilers** for their respective domains. This outputs a normalized **HarnessRun** packet with attached, immutable Approval Gates (Draft, User Required, Attorney Required).
5. **Cross-Domain Reconciliation (HarnessRuns → Boardroom):** *[NEW]* When domains conflict (e.g., Marketing urgency vs Legal blocks), agents utilize the MCP to invoke the **Boardroom Meta-Harness**. This engine ingests all relevant `HarnessRun` packets and resolves priorities (Legal/Security always overrides optimism), emitting a final strategic decision with rigid source citations.
6. **Backend Execution (Swarm → Cloud Functions):** Only after Harness states are compiled and gated, side-effectful work (DDEX delivery, Founder checkout, persistence) delegates to **Cloud Functions**, which write to Firestore/Storage.
7. **Generative AI (Cloud/Orchestration → AI):** Genkit and Vertex AI models handle creative output, audio synthesis, and conversational logic. The Gemini File Search API provides memory via Firestore embeddings.
8. **External Integrations (Cloud → External):** Cloud Functions handle final hand-offs to manual payment verification, DDEX Distributors, GitHub, and Maps. Any execution lacking proper Approval Gates is hard-rejected.
