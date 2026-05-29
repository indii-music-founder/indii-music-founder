# Agent Swarm & Intelligence Protocol Flowchart

This deep-dive flowchart maps the low-level technical execution of the indii Agent System. It details how the central Orchestrator (`AgentService`) routes tasks to specialists (`BaseAgent` subclasses), how agents use the native Gemini File Search API for RAG, and how deterministic tools are executed.

```mermaid
graph TD
    %% User & Client Interface
    subgraph Client ["Client Layer"]
        UI["Chat / UI Component (React)"]
        Store["Zustand AgentSlice / AppSlice"]
    end

    %% Orchestration Layer
    subgraph Orchestration ["Agent Orchestration (packages/renderer/src/services/agent/)"]
        AS["AgentService (Orchestrator)"]
        AR["AgentRegistry (registry.ts)"]
        Context["Context Injector (Brand Kit, Profile)"]
    end

    %% Decentralized Swarm Layer
    subgraph Swarm ["Specialist Agents (A2A Swarm)"]
        BA["BaseAgent (Abstract Class)"]
        Legal["LegalAgent"]
        Brand["BrandAgent"]
        Music["MusicAgent"]
        Creative["CreativeDirectorAgent"]
    end

    %% Intelligence & RAG Layer
    subgraph AI ["Gemini 3.0 AI & Context"]
        SDK["Google Generative AI SDK"]
        FileSearch["GeminiRetrievalService (File Search API)"]
        Memory["MemoryService (Firestore Semantic Memory)"]
    end

    %% Execution Layer
    subgraph Tools ["Deterministic Execution Layer"]
        ToolRegistry["Agent's `tools` Schema Array"]
        FuncMap["Agent's `functions` Map (TypeScript/Python)"]
    end

    %% Connections
    UI -->|"User prompt / File upload"| Store
    Store -->|"Dispatch `executeTask`"| AS
    
    AS -->|"Lookup active project context"| Context
    AS <-->|"Find suitable agent via `listCapabilities`"| AR
    
    AS -->|"Delegate Task (A2AClient)"| Legal
    AS -->|"Delegate Task (A2AClient)"| Brand
    
    Legal -.->|"Extends"| BA
    Brand -.->|"Extends"| BA
    Music -.->|"Extends"| BA
    Creative -.->|"Extends"| BA
    
    BA -->|"Constructs Payload (Context + Prompt)"| SDK
    
    SDK <-->|"Queries FileSearchStore"| FileSearch
    SDK <-->|"Retrieves Persistent Rules"| Memory
    
    SDK -->|"Returns `functionCalls` (Tool requests)"| BA
    BA -->|"Validates schema against"| ToolRegistry
    BA -->|"Executes deterministic logic in"| FuncMap
    FuncMap -->|"Returns function response to AI"| SDK
    
    SDK -->|"Final Answer `res.text()`"| AS
    AS -->|"Updates State"| Store
    Store -->|"Renders Output"| UI

    %% Styling
    style UI fill:#00D4FF,color:#000
    style Store fill:#00D4FF,color:#000
    
    style AS fill:#8A2BE2,color:#FFF
    style AR fill:#8A2BE2,color:#FFF
    style Context fill:#8A2BE2,color:#FFF
    
    style BA fill:#FF8C00,color:#000
    style Legal fill:#FF8C00,color:#000
    style Brand fill:#FF8C00,color:#000
    style Music fill:#FF8C00,color:#000
    style Creative fill:#FF8C00,color:#000
    
    style SDK fill:#39FF14,color:#000
    style FileSearch fill:#39FF14,color:#000
    style Memory fill:#39FF14,color:#000
    
    style ToolRegistry fill:#FF00FF,color:#FFF
    style FuncMap fill:#FF00FF,color:#FFF
```

## Transition Breakdown

1. **User Action:** The user submits a prompt or file in the UI, which updates the `Zustand` store. The store triggers `executeTask` on the `AgentService`.
2. **Context Injection:** `AgentService` reads the active workspace state (e.g., current Brand Kit, User Tier, Organization) and attaches this system context to the payload.
3. **Agent Routing:** `AgentService` queries the `AgentRegistry` to discover which specialized agent handles the intent (e.g., legal analysis goes to `LegalAgent`).
4. **Swarm Handoff:** The task is delegated to the specialist class extending `BaseAgent`. 
5. **AI Evaluation & RAG:** `BaseAgent` sends the prompt to the `Google Generative AI SDK` (Gemini 3.0 Pro). If context is needed, the model natively queries the `GeminiRetrievalService` (File Search API) or long-term facts from the `MemoryService`.
6. **Deterministic Tool Execution:** Instead of hallucinating complex math or system actions, Gemini returns a `functionCall`. `BaseAgent` intercepts this, verifies the function exists in its `tools` schema, and natively executes the actual TypeScript/Python logic stored in its `functions` map.
7. **Resolution:** The deterministic output is fed back to the AI for final reasoning, and the `res.text()` is dispatched back to the UI store.
