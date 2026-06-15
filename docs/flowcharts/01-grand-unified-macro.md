---
description: Grand Unified Macro Architecture mapping the entire indii platform ecosystem, from client interfaces to backend infrastructure and generative AI integrations.
---

# Grand Unified Macro Architecture

This macro-level flowchart provides a 30,000ft view of the entire indii platform. It illustrates the relationships between the client interfaces, authentication layer, UI module router, the 36 specialized modules (managers, departments, tools, standalone), the Zustand global state, the monolithic service layer, the AI Agent Swarm (and Business Harness), the creative production pipelines, backend Firebase Gen 2 infrastructure, external integrations, and the CI/CD deployment flow.

```mermaid
graph TB
    %% ╔══════════════════════════════════════════╗
    %% ║        CLIENT INTERFACE LAYER            ║
    %% ╚══════════════════════════════════════════╝
    subgraph CLIENTS ["🖥️ Client Interfaces (Entry Points)"]
        direction LR
        LP["Landing Page<br/>(packages/landing)<br/>Vite + React • Port 3000"]
        SA["indii Studio Web App<br/>(packages/renderer)<br/>Vite + React 18 • Port 4242"]
        ED["Electron Desktop Shell<br/>(packages/main)<br/>Electron 41 + Forge"]
        MR["indiiREMOTE<br/>(mobile-remote module)<br/>PWA • WebSocket Control"]
        INV["Investor Portal<br/>(investor module)<br/>Read-only Data Room"]
        CAP["Ghost Capture<br/>(capture module)<br/>Quick-capture PWA"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║    AUTHENTICATION & IDENTITY LAYER       ║
    %% ╚══════════════════════════════════════════╝
    subgraph AUTH ["🔐 Authentication & Identity"]
        direction LR
        LOGIN["Login/Signup UI"]
        FBAUTH["Firebase Auth Service"]
        BIOMETRIC["BiometricGate<br/>(Keytar OS Credentials)"]
        APPCHECK["Firebase App Check<br/>(reCAPTCHA Enterprise)"]
        ONBOARD["Onboarding Flow<br/>(Detroit Techno E2E)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║   NAVIGATION & MODULE ROUTING LAYER      ║
    %% ╚══════════════════════════════════════════╝
    subgraph NAV ["🧭 Navigation & Module Router"]
        direction TB
        SIDEBAR["Sidebar Navigation<br/>(3 Sections: Managers, Departments, Tools)"]
        CMDBAR["Unified Command Menu<br/>(⌘K Fuzzy Search)"]
        URLSYNC["URL Sync Router<br/>(React Router 7)"]
        MODROUTER["MODULE_COMPONENTS Registry<br/>(40 Lazy-loaded Modules)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        MANAGERS (6 Modules)              ║
    %% ╚══════════════════════════════════════════╝
    subgraph MANAGERS ["👔 Managers"]
        direction LR
        BRAND["Brand Manager"]
        ROAD["Road Manager<br/>(Touring)"]
        CAMPAIGN["Campaign Manager"]
        BOOKING["Booking Agent"]
        PUBLICIST["Publicist"]
        CREATIVE["Creative Director<br/>(Image + Video + 3D)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║      DEPARTMENTS (9 Modules)             ║
    %% ╚══════════════════════════════════════════╝
    subgraph DEPARTMENTS ["🏢 Departments"]
        direction LR
        MARKETING["Marketing Dept"]
        SOCIAL["Social Media Dept"]
        LEGAL["Legal Dept"]
        PUBLISHING["Publishing Dept"]
        FINANCE["Finance Dept"]
        DISTRIBUTION["Distribution Dept"]
        LICENSING["Licensing Dept"]
        MERCH["Art & Merch Dept"]
        REGISTRATION["Registration Center"]
        SECURITY_MOD["Security Agent"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║         TOOLS (6 Modules)                ║
    %% ╚══════════════════════════════════════════╝
    subgraph TOOLS ["🛠️ Tools"]
        direction LR
        WORKFLOW["Workflow Builder<br/>(React Flow DAG)"]
        AUDIO_ANALYZER["Audio Analyzer<br/>(Wavesurfer + Essentia)"]
        KNOWLEDGE["Knowledge Base<br/>(RAG + File Search)"]
        MEMORY_MOD["Memory Agent"]
        OBSERVABILITY["Command Center<br/>(Observability)"]
        SETTINGS["Settings Panel"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║   SPECIAL / STANDALONE MODULES           ║
    %% ╚══════════════════════════════════════════╝
    subgraph STANDALONE ["🎯 Standalone Modules (No Sidebar)"]
        direction LR
        DASHBOARD["HQ Dashboard"]
        FOUNDERS_CHECKOUT["Founders Checkout<br/>(Stripe)"]
        FOUNDERS_PORTAL["Founders Portal"]
        ANALYTICS["Growth Intelligence"]
        SCREENWRITER["Screenwriter"]
        CRM["CRM Dashboard"]
        DEVOPS["DevOps Dashboard"]
        MARKETPLACE["Marketplace"]
        VIDEO_POPOUT["Video Popout Editor"]
        FILES["File Dashboard"]
        HISTORY["History Dashboard"]
        DEBUG["Multimodal Gauntlet"]
        DESKTOP_MOD["Desktop Dashboard"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║    STATE MANAGEMENT (Zustand)            ║
    %% ╚══════════════════════════════════════════╝
    subgraph STATE ["📊 Zustand Global Store"]
        direction LR
        APPSLICE["appSlice<br/>(Module, Nav, UI)"]
        AUTHSLICE["authSlice<br/>(User, Session)"]
        AGENTSLICE["agentSlice<br/>(Swarm State)"]
        CREATIVESLICE["creativeSlice<br/>(Canvas, Drafts)"]
        DISTROSLICE["distributionSlice<br/>(Releases, DDEX)"]
        FSSLICE["fileSystemSlice<br/>(Uploads, Assets)"]
        FINANCESLICE["financeSlice<br/>(Billing, Ledger)"]
        PROFILESLICE["profileSlice<br/>(User, Org)"]
        WORKFLOWSLICE["workflowSlice<br/>(Automation)"]
        AUDIOSLICE["audioIntelligenceSlice<br/>(Analysis)"]
        MEMSLICE["memoryAgentSlice<br/>(Context)"]
        SUBSLICE["subscriptionSlice<br/>(Tier, Quota)"]
        EMAILSLICE["emailSlice<br/>(Campaigns)"]
        BOARDSLICE["boardroomSlice<br/>(Strategic)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║  SERVICE LAYER (66+ Services)            ║
    %% ╚══════════════════════════════════════════╝
    subgraph SERVICES ["⚙️ Service Layer (Business Logic)"]
        direction TB

        subgraph CORE_SERVICES ["Core Services"]
            FIREBASE_SVC["firebase.ts<br/>(Init, Auth, Firestore)"]
            MEMBERSHIP["MembershipService<br/>(Tier Gating, Quota)"]
            STORAGE_SVC["StorageService<br/>(Cloud Upload)"]
            FIRESTORE_SVC["FirestoreService<br/>(CRUD)"]
            ORG_SVC["OrganizationService"]
            USER_SVC["UserService"]
        end

        subgraph AI_SERVICES ["AI & Agent Services"]
            AGENT_SVC["AgentService<br/>(Execution Engine)"]
            BASE_AGENT["BaseAgent<br/>(Agent Core)"]
            ORCH_SVC["OrchestrationService<br/>(DAG Runner)"]
            A2A_CLIENT["A2AClient<br/>(P2P Delegation)"]
            CONTEXT_STACK["ContextStackService<br/>(Memory)"]
            RAG_AGENT["RAGAgent<br/>(File Search)"]
            GEMINI_SVC["GeminiRetrievalService"]
            REFLECTION["ReflectionLoop<br/>(Self-Improvement)"]
            BROWSER_AGENT["BrowserAgentService<br/>(Web Navigation)"]
            NUCLEUS["IndiiNucleus<br/>(Central Brain)"]
        end

        subgraph DOMAIN_SERVICES ["Domain Services"]
            WHISK["WhiskService<br/>(Image/Video Gen)"]
            REVENUE_SVC["RevenueService<br/>(Analytics)"]
            BILLING_SVC["billing/<br/>(Stripe Integration)"]
            DISTRIBUTION_SVC["distribution/<br/>(DDEX, SFTP)"]
            PUBLISHING_SVC["publishing/<br/>(Rights, Splits)"]
            LEGAL_SVC["legal/<br/>(Contracts)"]
            MARKETING_SVC["marketing/<br/>(Campaigns)"]
            MERCH_SVC["merchandise/<br/>(Merch Pipeline)"]
            TOURING_SVC["touring/<br/>(Routes, Venues)"]
            SOCIAL_SVC["social/<br/>(Cross-posting)"]
            LICENSING_SVC["licensing/<br/>(Sync, Master)"]
        end

        subgraph INFRA_SERVICES ["Infrastructure Services"]
            STORAGE_QUOTA["StorageQuotaService"]
            CLOUD_STORAGE["CloudStorageService"]
            COST_BREAKER["CostCircuitBreaker"]
            SYNC_SVC["sync/<br/>(Cross-device)"]
            PERSISTENCE["persistence/<br/>(Local Cache)"]
            NOTIFICATIONS["notifications/"]
            MONITORING_SVC["monitoring/"]
            OBSERVABILITY_SVC["observability/<br/>(Sentry)"]
        end
    end

    %% ╔══════════════════════════════════════════╗
    %% ║    AI ORCHESTRATION & AGENT SWARM        ║
    %% ╚══════════════════════════════════════════╝
    subgraph AGENT_SYSTEM ["🤖 AI Agent Orchestration"]
        direction TB

        subgraph CONDUCTOR ["indii Conductor"]
            GRAPH_SVC["AgentGraphService<br/>(DAG Execution)"]
            REGISTRY["Agent Registry<br/>(capability_registry.json)"]
            LOOP_DETECT["LoopDetector<br/>(Anti-Spiral)"]
            LIVING_PLAN["LivingPlanService<br/>(Adaptive Plans)"]
        end

        subgraph SWARM ["A2A Specialist Swarm (Decentralized)"]
            direction LR
            S_LEGAL["Legal Agent"]
            S_MKT["Marketing Agent"]
            S_BRAND["Brand Agent"]
            S_CREATIVE["Creative Agent"]
            S_FINANCE["Finance Agent"]
            S_MUSIC["Music Agent"]
            S_DIST["Distribution Agent"]
            S_PUB["Publishing Agent"]
            S_MERCH["Merchandise Agent"]
            S_ROAD["Road Agent"]
            S_SOCIAL["Social Agent"]
            S_LICENSING["Licensing Agent"]
            S_SECURITY["Security Agent"]
            S_ANALYTICS["Analytics Agent"]
            S_DEVOPS["DevOps Agent"]
            S_SCREEN["Screenwriter Agent"]
            S_GENERALIST["Generalist Agent"]
            S_CURRICULUM["Curriculum Agent"]
            S_VIDEO["Video Agent"]
        end

        subgraph HARNESS ["Business Harness Engine (Deterministic)"]
            MCP_SERVER["indii-harness<br/>(MCP Server)"]
            COMPILERS["HarnessCompilers<br/>(22 Domains)"]
            HARNESS_RUN["HarnessRun<br/>(State Packet + Gates)"]
            BOARDROOM_META["Boardroom Meta-Harness<br/>(Cross-Domain Reconciler)"]
        end
    end

    %% ╔══════════════════════════════════════════╗
    %% ║     CREATIVE PRODUCTION PIPELINE         ║
    %% ╚══════════════════════════════════════════╝
    subgraph CREATIVE_PIPELINE ["🎨 Creative Production Pipeline"]
        direction LR
        CANVAS["Fabric.js Canvas<br/>(Image Editor)"]
        REMOTION["Remotion<br/>(Video Renderer)"]
        THREE_JS["Three.js<br/>(3D Stage Builder)"]
        PROMPT_BUILDER["Prompt Builder<br/>(AI Generation)"]
        IMG_GEN["Image Generation<br/>(Nano Banana)"]
        VID_GEN["Video Generation<br/>(Veo 3.1)"]
        AUDIO_GEN["Audio Generation<br/>(TTS / Music)"]
        DAISY_CHAIN["Video Daisy Chain<br/>(Multi-scene Composition)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║    AUDIO INTELLIGENCE PIPELINE           ║
    %% ╚══════════════════════════════════════════╝
    subgraph AUDIO_PIPELINE ["🎵 Audio Intelligence Pipeline"]
        direction LR
        WAVESURFER["Wavesurfer.js<br/>(Waveform Viz)"]
        ESSENTIA["Essentia.js<br/>(Feature Extraction)"]
        YAMNET["YAMNet ONNX<br/>(Classification)"]
        BPM_KEY["BPM/Key Detection"]
        MASTERING_ANALYSIS["Mastering Analysis"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║   DISTRIBUTION & RIGHTS ENGINE           ║
    %% ╚══════════════════════════════════════════╝
    subgraph DISTRO_ENGINE ["📦 Distribution & Rights Engine"]
        direction LR
        DDEX["DDEX XML Builder"]
        SFTP_UPLOAD["SFTP Uploader<br/>(ssh2)"]
        INGESTION["Proprietary Ingestion<br/>(Asset Pipeline)"]
        RIGHTS_MGMT["Rights Management<br/>(Splits, Royalties)"]
        SYNC_TAGGER["Sync Tagger<br/>(Metadata)"]
        WEB3_SPLIT["Web3 Splitter<br/>(Smart Contracts)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║    BACKEND INFRASTRUCTURE                ║
    %% ╚══════════════════════════════════════════╝
    subgraph BACKEND ["☁️ Backend Infrastructure (Firebase Gen 2)"]
        direction TB

        subgraph CF ["Cloud Functions (Node 22)"]
            CF_AUTH["Auth Triggers"]
            CF_DIST["Distribution Functions"]
            CF_PUB["Publishing Functions"]
            CF_LEGAL["Legal Functions"]
            CF_SOCIAL["Social Functions"]
            CF_EMAIL["Email Functions"]
            CF_STRIPE["Stripe Webhooks"]
            CF_ANALYTICS["Analytics Functions"]
            CF_ORCH["Orchestration Functions"]
            CF_MCP["MCP Server Functions"]
            CF_STREAMING["Streaming Functions"]
            CF_RELAY["Relay Functions"]
            CF_TIMELINE["Timeline Functions"]
            CF_RELEASES["Release Functions"]
            CF_DEVOPS["DevOps Functions"]
        end

        subgraph DATA ["Data Layer"]
            FIRESTORE["Firestore<br/>(Primary Database)"]
            CLOUD_STOR["Cloud Storage<br/>(Assets, Media)"]
            BIGQUERY["BigQuery<br/>(Revenue Analytics)"]
        end

        subgraph JOBS ["Background Jobs"]
            INNGEST["Inngest<br/>(Job Orchestrator)"]
            DAEMONS["Daemon Functions<br/>(Scheduled)"]
        end

        subgraph SECURITY_LAYER ["Security Layer"]
            FS_RULES["firestore.rules"]
            STOR_RULES["storage.rules"]
            CSP["Content Security Policy"]
            APPCHECK_BE["App Check Verification"]
        end
    end

    %% ╔══════════════════════════════════════════╗
    %% ║    GENERATIVE AI STACK                   ║
    %% ╚══════════════════════════════════════════╝
    subgraph AI_STACK ["🧠 Generative AI Stack (Genkit + Vertex AI)"]
        direction LR
        GEM_PRO["gemini-3-pro<br/>(Complex Reasoning)"]
        GEM_FLASH["gemini-3-flash<br/>(Fast Tasks)"]
        GEM_IMG["gemini-3.1-pro-image<br/>(Image Gen)"]
        VEO_VID["veo-3.1-generate<br/>(Video Gen)"]
        GEM_TTS["gemini-2.5-pro-tts<br/>(Text-to-Speech)"]
        FILE_SEARCH["Gemini File Search<br/>(RAG Memory)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║    EXTERNAL INTEGRATIONS                 ║
    %% ╚══════════════════════════════════════════╝
    subgraph EXTERNAL ["🌐 External Integrations"]
        direction LR
        STRIPE_EXT["Stripe<br/>(Payments)"]
        DSP_EXT["Music Distributors<br/>(SFTP, DDEX)"]
        MAPS_EXT["Google Maps<br/>(Routing)"]
        GITHUB_EXT["GitHub<br/>(Bug Reports)"]
        SENTRY_EXT["Sentry<br/>(Observability)"]
        TELEGRAM_EXT["Telegram<br/>(Alerts)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║   ELECTRON DESKTOP LAYER                 ║
    %% ╚══════════════════════════════════════════╝
    subgraph ELECTRON ["💻 Electron Desktop Layer"]
        direction LR
        MAIN_PROC["Main Process<br/>(packages/main)"]
        IPC["IPC Bridge<br/>(Preload Script)"]
        FFMPEG["FFmpeg/FFProbe<br/>(A/V Processing)"]
        KEYTAR["Keytar<br/>(Credential Storage)"]
        AUTO_UPDATE["Electron Auto-Updater"]
        FORGE["Electron Forge 7.8"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        CI/CD PIPELINE                    ║
    %% ╚══════════════════════════════════════════╝
    subgraph CICD ["🚀 CI/CD Pipeline"]
        direction LR
        GH_ACTIONS["GitHub Actions"]
        LINT["ESLint Check"]
        TYPECHECK["TypeScript Check"]
        VITEST["Vitest<br/>(Unit Tests)"]
        PLAYWRIGHT["Playwright<br/>(E2E Specs)"]
        VITE_BUILD["Vite Build"]
        FB_DEPLOY["Firebase Deploy"]
    end

    %% ════════════════════════════════════════════
    %% ║           CONNECTIONS                    ║
    %% ════════════════════════════════════════════

    %% Client → Auth
    LP -->|"Auth Bridge Handoff"| LOGIN
    SA --> LOGIN
    ED -->|"IPC"| LOGIN
    MR -->|"WebSocket Auth"| LOGIN
    LOGIN --> FBAUTH
    FBAUTH --> APPCHECK
    ED --> BIOMETRIC
    FBAUTH -->|"New User"| ONBOARD

    %% Auth → State
    FBAUTH -->|"Credentials"| AUTHSLICE
    ONBOARD -->|"Profile Setup"| PROFILESLICE

    %% Client → Navigation
    SA --> SIDEBAR
    SA --> CMDBAR
    SA --> URLSYNC
    SIDEBAR --> MODROUTER
    CMDBAR --> MODROUTER
    URLSYNC --> MODROUTER

    %% Module Router → Module Groups
    MODROUTER --> MANAGERS
    MODROUTER --> DEPARTMENTS
    MODROUTER --> TOOLS
    MODROUTER --> STANDALONE

    %% Modules → State (bidirectional)
    MANAGERS --> STATE
    DEPARTMENTS --> STATE
    TOOLS --> STATE
    STANDALONE --> STATE

    %% Modules → Services
    CREATIVE -->|"Image/Video/3D"| CREATIVE_PIPELINE
    AUDIO_ANALYZER --> AUDIO_PIPELINE
    DISTRIBUTION -->|"Release Pipeline"| DISTRO_ENGINE
    PUBLISHING -->|"Rights/Splits"| RIGHTS_MGMT
    FINANCE -->|"Billing"| BILLING_SVC
    ROAD -->|"Tour Planning"| TOURING_SVC
    MARKETING -->|"Campaigns"| MARKETING_SVC
    LEGAL -->|"Contracts"| LEGAL_SVC
    MERCH -->|"Merch Design"| MERCH_SVC
    SOCIAL -->|"Cross-post"| SOCIAL_SVC
    LICENSING -->|"Sync Licensing"| LICENSING_SVC

    %% Services → Agent System
    AGENT_SVC --> GRAPH_SVC
    GRAPH_SVC --> REGISTRY
    GRAPH_SVC --> LOOP_DETECT
    GRAPH_SVC --> LIVING_PLAN
    AGENT_SVC --> A2A_CLIENT
    A2A_CLIENT -->|"consult_specialist"| SWARM
    NUCLEUS --> AGENT_SVC

    %% Swarm ↔ Harness (Deterministic Layer)
    SWARM -->|"MCP: compile_harness"| MCP_SERVER
    MCP_SERVER --> COMPILERS
    COMPILERS -->|"Generates with Approval Gates"| HARNESS_RUN
    HARNESS_RUN -->|"Persisted"| FIRESTORE
    SWARM -->|"MCP: create_boardroom_decision"| BOARDROOM_META
    HARNESS_RUN -->|"Ingested"| BOARDROOM_META
    BOARDROOM_META -->|"BoardroomHarnessDecision"| SWARM

    %% Creative Pipeline → AI
    IMG_GEN --> GEM_IMG
    VID_GEN --> VEO_VID
    AUDIO_GEN --> GEM_TTS
    PROMPT_BUILDER --> GEM_PRO
    GEMINI_SVC --> GEM_PRO
    GEMINI_SVC --> GEM_FLASH

    %% Services → Backend
    CORE_SERVICES --> CF
    DOMAIN_SERVICES --> CF
    CF_AUTH -->|"Creates Profile"| FIRESTORE
    CF_STRIPE --> STRIPE_EXT
    CF_DIST --> DSP_EXT
    CF_ANALYTICS --> BIGQUERY
    CF_EMAIL --> EXTERNAL
    CF_RELAY -->|"WebSocket"| MR

    %% Data Layer
    CF --> FIRESTORE
    CF --> CLOUD_STOR
    FIRESTORE --> FS_RULES
    CLOUD_STOR --> STOR_RULES
    INNGEST --> CF

    %% AI Stack connections
    AGENT_SVC --> AI_STACK
    CF --> AI_STACK
    RAG_AGENT --> FILE_SEARCH
    FILE_SEARCH --> FIRESTORE

    %% State ↔ Backend Sync
    FIRESTORE -.->|"onSnapshot Listeners"| STATE
    STATE -.->|"WebSocket Broadcast"| MR

    %% Electron specifics
    ED --> MAIN_PROC
    MAIN_PROC --> IPC
    IPC --> SA
    MAIN_PROC --> FFMPEG
    MAIN_PROC --> KEYTAR
    MAIN_PROC --> AUTO_UPDATE
    AUTO_UPDATE --> FORGE

    %% External Integrations
    OBSERVABILITY_SVC --> SENTRY_EXT
    SFTP_UPLOAD --> DSP_EXT
    TOURING_SVC --> MAPS_EXT
    MONITORING_SVC --> TELEGRAM_EXT

    %% CI/CD Flow
    GITHUB_EXT --> GH_ACTIONS
    GH_ACTIONS --> LINT
    LINT --> TYPECHECK
    TYPECHECK --> VITEST
    VITEST --> PLAYWRIGHT
    PLAYWRIGHT --> VITE_BUILD
    VITE_BUILD --> FB_DEPLOY

    %% ════════════════════════════════════════════
    %% ║            STYLING                       ║
    %% ════════════════════════════════════════════

    classDef client fill:#00D4FF,stroke:#0077AA,stroke-width:2px,color:#001018
    classDef auth fill:#FF00FF,stroke:#AA00AA,stroke-width:2px,color:#FFFFFF
    classDef nav fill:#6366F1,stroke:#4338CA,stroke-width:2px,color:#FFFFFF
    classDef manager fill:#F59E0B,stroke:#B45309,stroke-width:2px,color:#001018
    classDef dept fill:#10B981,stroke:#047857,stroke-width:2px,color:#001018
    classDef tool fill:#8B5CF6,stroke:#6D28D9,stroke-width:2px,color:#FFFFFF
    classDef standalone fill:#EC4899,stroke:#BE185D,stroke-width:2px,color:#FFFFFF
    classDef state fill:#39FF14,stroke:#1A8800,stroke-width:2px,color:#001018
    classDef service fill:#FF8C00,stroke:#AA5500,stroke-width:2px,color:#001018
    classDef agent fill:#E11D48,stroke:#9F1239,stroke-width:2px,color:#FFFFFF
    classDef harness fill:#D946EF,stroke:#A21CAF,stroke-width:2px,color:#FFFFFF
    classDef creative fill:#F472B6,stroke:#DB2777,stroke-width:2px,color:#001018
    classDef audio fill:#22D3EE,stroke:#0891B2,stroke-width:2px,color:#001018
    classDef distro fill:#A78BFA,stroke:#7C3AED,stroke-width:2px,color:#001018
    classDef backend fill:#FB923C,stroke:#C2410C,stroke-width:2px,color:#001018
    classDef ai fill:#4ADE80,stroke:#16A34A,stroke-width:2px,color:#001018
    classDef external fill:#F87171,stroke:#DC2626,stroke-width:2px,color:#FFFFFF
    classDef electron fill:#60A5FA,stroke:#2563EB,stroke-width:2px,color:#001018
    classDef cicd fill:#FBBF24,stroke:#D97706,stroke-width:2px,color:#001018

    class LP,SA,ED,MR,INV,CAP client
    class LOGIN,FBAUTH,BIOMETRIC,APPCHECK,ONBOARD auth
    class SIDEBAR,CMDBAR,URLSYNC,MODROUTER nav
    class BRAND,ROAD,CAMPAIGN,BOOKING,PUBLICIST,CREATIVE manager
    class MARKETING,SOCIAL,LEGAL,PUBLISHING,FINANCE,DISTRIBUTION,LICENSING,MERCH,REGISTRATION,SECURITY_MOD dept
    class WORKFLOW,AUDIO_ANALYZER,KNOWLEDGE,MEMORY_MOD,OBSERVABILITY,SETTINGS tool
    class DASHBOARD,FOUNDERS_CHECKOUT,FOUNDERS_PORTAL,ANALYTICS,SCREENWRITER,CRM,DEVOPS,MARKETPLACE,VIDEO_POPOUT,FILES,HISTORY,DEBUG,DESKTOP_MOD standalone
    class APPSLICE,AUTHSLICE,AGENTSLICE,CREATIVESLICE,DISTROSLICE,FSSLICE,FINANCESLICE,PROFILESLICE,WORKFLOWSLICE,AUDIOSLICE,MEMSLICE,SUBSLICE,EMAILSLICE,BOARDSLICE state
    class FIREBASE_SVC,MEMBERSHIP,STORAGE_SVC,FIRESTORE_SVC,ORG_SVC,USER_SVC,AGENT_SVC,BASE_AGENT,ORCH_SVC,A2A_CLIENT,CONTEXT_STACK,RAG_AGENT,GEMINI_SVC,REFLECTION,BROWSER_AGENT,NUCLEUS,WHISK,REVENUE_SVC,BILLING_SVC,DISTRIBUTION_SVC,PUBLISHING_SVC,LEGAL_SVC,MARKETING_SVC,MERCH_SVC,TOURING_SVC,SOCIAL_SVC,LICENSING_SVC,STORAGE_QUOTA,CLOUD_STORAGE,COST_BREAKER,SYNC_SVC,PERSISTENCE,NOTIFICATIONS,MONITORING_SVC,OBSERVABILITY_SVC service
    class GRAPH_SVC,REGISTRY,LOOP_DETECT,LIVING_PLAN,S_LEGAL,S_MKT,S_BRAND,S_CREATIVE,S_FINANCE,S_MUSIC,S_DIST,S_PUB,S_MERCH,S_ROAD,S_SOCIAL,S_LICENSING,S_SECURITY,S_ANALYTICS,S_DEVOPS,S_SCREEN,S_GENERALIST,S_CURRICULUM,S_VIDEO agent
    class MCP_SERVER,COMPILERS,HARNESS_RUN,BOARDROOM_META harness
    class CANVAS,REMOTION,THREE_JS,PROMPT_BUILDER,IMG_GEN,VID_GEN,AUDIO_GEN,DAISY_CHAIN creative
    class WAVESURFER,ESSENTIA,YAMNET,BPM_KEY,MASTERING_ANALYSIS audio
    class DDEX,SFTP_UPLOAD,INGESTION,RIGHTS_MGMT,SYNC_TAGGER,WEB3_SPLIT distro
    class CF_AUTH,CF_DIST,CF_PUB,CF_LEGAL,CF_SOCIAL,CF_EMAIL,CF_STRIPE,CF_ANALYTICS,CF_ORCH,CF_MCP,CF_STREAMING,CF_RELAY,CF_TIMELINE,CF_RELEASES,CF_DEVOPS,FIRESTORE,CLOUD_STOR,BIGQUERY,INNGEST,DAEMONS,FS_RULES,STOR_RULES,CSP,APPCHECK_BE backend
    class GEM_PRO,GEM_FLASH,GEM_IMG,VEO_VID,GEM_TTS,FILE_SEARCH ai
    class STRIPE_EXT,DSP_EXT,MAPS_EXT,GITHUB_EXT,SENTRY_EXT,TELEGRAM_EXT external
    class MAIN_PROC,IPC,FFMPEG,KEYTAR,AUTO_UPDATE,FORGE electron
    class GH_ACTIONS,LINT,TYPECHECK,VITEST,PLAYWRIGHT,VITE_BUILD,FB_DEPLOY cicd
```

## Transition Breakdown

1. **Client to Auth**: A user begins at one of six client interfaces (Landing Page, Web App, Desktop, Remote, Investor Portal, or Ghost Capture). The UI hands them off to the Firebase Auth Service via the Login/Signup UI. Firebase App Check (reCAPTCHA) verifies the client integrity.
2. **Auth to Navigation**: Upon successful auth, credentials update the `authSlice` in Zustand. The user is then directed to the Navigation layer where the Sidebar, Command Bar (⌘K), or React Router map the user to the correct lazy-loaded module.
3. **Module to State/Services**: One of the 40+ modules (Managers, Departments, Tools, or Standalone) mounts. It connects bidirectionally to the Zustand Global Store to read/write state, and calls downward into the Domain Services (e.g., Marketing, Legal, Creative) to execute business logic.
4. **Service to Agent System**: If an action requires AI reasoning, the Domain Service calls `AgentService.execute()`. This queries the `AgentGraphService` (the Conductor) which builds a DAG of tasks.
5. **Swarm Execution**: The Conductor delegates to specific agents in the A2A Specialist Swarm. These agents use Genkit + Gemini APIs to reason. If they need cross-domain help, they use the `A2AClient` to consult peers.
6. **Agent to Deterministic Harness**: If an agent needs to perform a highly sensitive database action (like transferring funds or releasing music), it calls the `indii-harness` MCP Server. The Harness compiles a deterministic "Harness Run" with strict human-approval gates before saving to Firestore.
7. **Agent to Backend**: Standard agent actions fire Cloud Functions via `AgentService`. These Cloud Functions manipulate Firestore, Cloud Storage, or BigQuery, secured by `firestore.rules` and `storage.rules`.
8. **Backend to State (Sync)**: Changes in Firestore trigger real-time `onSnapshot` listeners on the client, which update the Zustand store, immediately re-rendering the UI. 
9. **Desktop to External**: Electron-specific modules communicate over the IPC bridge to run local FFmpeg/FFProbe processes or securely access OS credentials via Keytar.
10. **CI/CD Pipeline**: Any code merges trigger GitHub Actions, flowing through ESLint, TypeScript compilation, Vitest (Unit), Playwright (E2E), Vite bundling, and finally deploying to Firebase Hosting.
