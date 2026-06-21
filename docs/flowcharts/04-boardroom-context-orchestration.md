---
description: Advanced architectural mapping of the Boardroom Conductor's context orchestration, highlighting the injection of the SEATED_AGENTS manifest, the useBoardroomContextHandshake hook, and dynamic module loading.
---

# Boardroom Context Orchestration

This flowchart illustrates the intricate context synchronization that occurs when users interact with the Boardroom HQ. It maps how the Conductor is made aware of the exact UI state, how external module state (like Creative Studio drafts) is automatically injected into the agent's memory via the `useBoardroomContextHandshake` hook, and how race conditions during concurrent multi-agent delegations are mitigated by the `ModuleImportCache`.

```mermaid
graph TD
    %% ╔══════════════════════════════════════════╗
    %% ║        UI & CONTEXT TRIGGERS             ║
    %% ╚══════════════════════════════════════════╝
    subgraph UI ["🖥️ UI Layer"]
        B_ENTER["User enters Boardroom Mode"]
        SEAT_UI["User seats an Agent<br/>(e.g., Marketing)"]
        PROMPT["User sends Boardroom Prompt"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        STATE ORCHESTRATION               ║
    %% ╚══════════════════════════════════════════╝
    subgraph STATE ["📊 Zustand Global Store"]
        APP_STATE["appSlice<br/>(conversationMode: 'boardroom')"]
        UI_REGISTRY["UI Agent Registry<br/>(Visual 'seated' state)"]
        CREATIVE["creativeSlice<br/>(Recent image/video drafts)"]
        DISTRO["distributionSlice<br/>(Pending releases)"]
        MEM_STORE["referencedAssets<br/>(Injected context payload)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        HANDSHAKE & RESOLUTION            ║
    %% ╚══════════════════════════════════════════╝
    subgraph HANDSHAKE ["🤝 useBoardroomContextHandshake"]
        EXTRACT["Extract Top 3 Images &<br/>Top 2 Releases"]
        DEDUP["Deduplicate by ID"]
        INJECT["Inject to state.addReferencedAsset()"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        AGENT CONDUCTOR (DAG)             ║
    %% ╚══════════════════════════════════════════╝
    subgraph CONDUCTOR ["🤖 indii Conductor (GeneralistAgent)"]
        RESOLVER["ContextResolver<br/>(Maps boardroomMessages)"]
        MANIFEST["[SEATED_AGENTS]<br/>Manifest Builder"]
        EXEC["execute() loop"]
        SYS_PROMPT["fullSystemPrompt Injection"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        MODULE LOADING & DELEGATION       ║
    %% ╚══════════════════════════════════════════╝
    subgraph CACHE ["🚀 ModuleImportCache"]
        REQ1["Import Request A"]
        REQ2["Import Request B"]
        CACHED["Cached Promise<br/>(Ref-counted)"]
        BACKOFF["Exponential Backoff Retry"]
    end
    
    subgraph SWARM ["A2A Specialist Swarm"]
        AGENT_A["Agent A"]
        AGENT_B["Agent B"]
        AGENT_C["Agent C"]
    end

    %% Flow connections
    B_ENTER --> APP_STATE
    B_ENTER --> EXTRACT
    SEAT_UI --> UI_REGISTRY
    
    EXTRACT -->|Reads| CREATIVE
    EXTRACT -->|Reads| DISTRO
    EXTRACT --> DEDUP
    DEDUP --> INJECT
    INJECT -->|Writes| MEM_STORE

    PROMPT --> RESOLVER
    RESOLVER -->|Reads boardroom messages| EXEC
    
    UI_REGISTRY --> MANIFEST
    MANIFEST -->|Injects precise agent IDs| SYS_PROMPT
    MEM_STORE -->|Injects asset URLs| SYS_PROMPT
    SYS_PROMPT --> EXEC
    
    EXEC -->|Simultaneous Delegation| REQ1
    EXEC -->|Simultaneous Delegation| REQ2
    
    REQ1 --> CACHED
    REQ2 --> CACHED
    CACHED -->|Fails?| BACKOFF
    CACHED -->|Succeeds| SWARM
    SWARM --> AGENT_A
    SWARM --> AGENT_B
    SWARM --> AGENT_C

    classDef ui fill:#00D4FF,stroke:#0077AA,stroke-width:2px,color:#001018
    classDef state fill:#39FF14,stroke:#1A8800,stroke-width:2px,color:#001018
    classDef handshake fill:#FF8C00,stroke:#AA5500,stroke-width:2px,color:#001018
    classDef conductor fill:#E11D48,stroke:#9F1239,stroke-width:2px,color:#FFFFFF
    classDef cache fill:#8B5CF6,stroke:#6D28D9,stroke-width:2px,color:#FFFFFF

    class B_ENTER,SEAT_UI,PROMPT ui
    class APP_STATE,UI_REGISTRY,CREATIVE,DISTRO,MEM_STORE state
    class EXTRACT,DEDUP,INJECT handshake
    class RESOLVER,MANIFEST,EXEC,SYS_PROMPT conductor
    class REQ1,REQ2,CACHED,BACKOFF cache
```

## Transition Breakdown

1. **Boardroom Handshake Trigger**: When the user enters Boardroom mode, the `useBoardroomContextHandshake` hook fires. It reads the latest state from the `creativeSlice` and `distributionSlice`.
2. **Context Deduplication**: The hook extracts up to 3 recent images and 2 pending releases, deduplicates them against the current `referencedAssets` by ID, and injects them back into the state via `addReferencedAsset()`. This ensures agents are immediately aware of the user's recent actions in other modules without manual briefing.
3. **Seated Agents Manifest**: As the user seats agents in the UI, the `UI Agent Registry` updates. When a prompt is sent, the Conductor (`GeneralistAgent`) builds a strict `[SEATED_AGENTS]` manifest mapping the natural language names to exact system IDs.
4. **Context Injection**: The `ContextResolver` ensures the Conductor reads from the shared `boardroomMessages` history. The Conductor explicitly injects both the `[SEATED_AGENTS]` manifest and the `referencedAssets` into its `fullSystemPrompt` before calling the LLM.
5. **Concurrent Delegation**: If the LLM output requires delegating tasks to 3 or more agents simultaneously, the execution triggers dynamic Vite module imports.
6. **Race Condition Mitigation**: Instead of causing a `ChunkLoadError` race condition, the `ModuleImportCache` intercepts these concurrent imports. It returns a single, ref-counted cached Promise for identical chunks, preventing Vite from panicking. If a genuine chunk load failure occurs, the cache applies an exponential backoff retry.
7. **Backend LLM Call (added 2026-06-20)**: After `fullSystemPrompt` injection, the Conductor's `execute()` loop streams the completion from the backend via `FirebaseIntelligenceService.callBackendGenerateContentStream()`, which `POST`s to the **`generateContentStream`** Cloud Function (`https://us-central1-<project>.cloudfunctions.net/generateContentStream`) with a Firebase ID token (`Authorization: Bearer`) and an App Check token (`x-firebase-appcheck`). A `401` here surfaces in chat as `Error: Unauthorized: Missing App Check token`. Note this function shares `index.ts`'s module graph, so a cold-start crash anywhere in that graph (e.g. the `@indii/shared` workspace-import regression) takes the Conductor down even though the client flow above is healthy. See `security-csp-appcheck-integration.md` and ERROR_LEDGER 2026-06-20.
