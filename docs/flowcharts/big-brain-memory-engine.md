# BigBrain Memory Engine Architecture Flowchart

This flowchart maps the `BigBrainEngine`, the sophisticated 5-layer persistent state and memory architecture that powers the Gemini Enterprise Agent Platform (GEAP) integration. It illustrates how ephemeral conversation state is distilled into long-term, authoritative facts.

```mermaid
graph TD
    %% Entry Layer
    subgraph Conversation ["Conversation Runtime"]
        Interaction["User Interaction / Agent Dialogue"]
        Orchestrator["BigBrainEngine (Memory Orchestrator)"]
    end

    %% The 5 Memory Layers
    subgraph MemoryLayers ["The 5-Layer Architecture"]
        Layer1["1. Ephemeral / Background<br/>(`AlwaysOnMemoryEngine`)"]
        Layer2["2. Episodic / Session<br/>(`CaptainsLogService`)"]
        Layer3["3. Long-term Vector<br/>(`DeepHiveService`)"]
        Layer4["4. User Alignment<br/>(`UserMemoryService`)"]
        Layer5["5. Authoritative Moat<br/>(`CoreVaultService`)"]
    end

    %% Storage Backends
    subgraph Storage ["Storage / Integration Layer"]
        SessionState["Local Session State"]
        GEAP_MemBank["GEAP Memory Bank (Managed API)"]
        GEAP_Vector["GEAP Vector Search"]
        Hybrid["Hybrid / Memory Profiles"]
        Firestore["Firestore (Authoritative Facts)"]
    end

    %% Transitions
    Interaction --> Orchestrator
    
    Orchestrator -->|"Manages Short-term context"| Layer1
    Orchestrator -->|"Catalogs Conversations"| Layer2
    Orchestrator -->|"Semantic Search Queries"| Layer3
    Orchestrator -->|"Extracts explicit preferences"| Layer4
    Orchestrator -->|"Commits unquestionable truth"| Layer5

    Layer1 -.->|"Distills into"| SessionState
    Layer2 -.->|"Migrated to"| GEAP_MemBank
    Layer3 -.->|"Powered by"| GEAP_Vector
    Layer4 -.->|"Persisted as"| Hybrid
    Layer5 -.->|"Locked in"| Firestore

    %% Strict Rules
    subgraph Hierarchy ["Memory Resolution Hierarchy"]
        Resolution["Layer 5 (CoreVault) ALWAYS overrides lower layers during synthesis"]
    end
    Layer5 -.-> Hierarchy

    %% Styling
    style Interaction fill:#00D4FF,color:#000
    style Orchestrator fill:#FF00FF,color:#FFF
    
    style Layer1 fill:#8A2BE2,color:#FFF
    style Layer2 fill:#8A2BE2,color:#FFF
    style Layer3 fill:#8A2BE2,color:#FFF
    style Layer4 fill:#8A2BE2,color:#FFF
    style Layer5 fill:#39FF14,color:#000
    
    style GEAP_MemBank fill:#FF8C00,color:#000
    style GEAP_Vector fill:#FF8C00,color:#000
    style Firestore fill:#39FF14,color:#000
    
    style Hierarchy fill:#FF3333,color:#FFF,stroke-dasharray: 5 5
```

## Transition Breakdown

1. **Orchestration:** Every interaction runs through the `BigBrainEngine`. Rather than forcing an agent to query multiple databases, the engine aggregates memory from 5 distinct layers to build the `memoryContext` injected into the agent's prompt.
2. **Layer 1 (Always-On):** Handles the immediate, ephemeral context of the current background tasks and active window states.
3. **Layer 2 (Captain's Log):** Handles episodic memory. Instead of a raw transcript, the system catalogs summaries of past sessions. This is migrated to Google's managed GEAP Memory Bank API for automatic curation.
4. **Layer 3 (Deep Hive):** Handles long-term semantic knowledge. When a user asks a complex question that relates to something discussed weeks ago, the `DeepHiveService` uses GEAP's Vector Search to pull the highly relevant chunks back into context.
5. **Layer 4 (User Alignment):** Explicitly tracks user preferences, risk tolerance, and creative style constraints. It combines implicit auto-extraction with explicit user-defined memory profiles.
6. **Layer 5 (Core Vault):** The most critical layer. This stores authoritative facts—financial numbers, legal obligations, and confirmed metadata. The `CoreVaultService` is strictly deterministic, backed by Firestore, and its contents **always** override conflicting memories surfaced by the semantic or episodic layers.
