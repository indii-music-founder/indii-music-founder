# Entire App Architecture Flowchart

This macro flowchart depicts the high-level system architecture of indii. It illustrates the interaction between client interfaces, the frontend orchestration layer, the decentralized A2A (Agent-to-Agent) Swarm of specialist agents, and the backend cloud infrastructure powered by Firebase and Vertex AI.

```mermaid
graph TD
    %% User Action Layer
    subgraph Client ["Client Interfaces"]
        LP["Landing Page"]
        SA["Studio Web App (React)"]
        ES["Electron Desktop Shell"]
    end

    %% State & Management Layer
    subgraph State ["State & Orchestration (Frontend)"]
        ZS["Zustand Global Store"]
        AS["AgentService (indii Agent Zero)"]
        AR["Agent Registry"]
    end

    %% Service & Logic Layer
    subgraph Specialists ["Decentralized A2A Swarm (Specialist Agents)"]
        LA["Legal Agent"]
        MA["Marketing Agent"]
        BA["Brand Agent"]
        CA["Creative Agent"]
        RA["Road Agent"]
        FA["Finance Agent"]
        MuA["Music Agent"]
    end

    %% Backend & Intelligence Layer
    subgraph Cloud ["Backend & Cloud Infrastructure"]
        FF["Firebase Functions (Gen 2)"]
        FS["Firestore Database"]
        CS["Cloud Storage"]
        Vertex["Vertex AI (Veo 3.1, Gemini 3.0)"]
        FileSearch["Gemini File Search API (RAG/Memory)"]
    end

    %% External Systems
    subgraph External ["External Services"]
        Stripe["Stripe Checkout & Webhooks"]
    end

    %% Connections
    LP -->|"CTA/Auth"| SA
    ES -->|"Wraps"| SA
    SA -->|"Dispatches Actions"| ZS
    SA -->|"User Prompts/Tasks"| AS
    
    ZS -->|"Provides Context"| AS
    AS <-->|"Discovers via"| AR
    AS -->|"Delegates Task"| Specialists
    
    Specialists <-->|"A2A Swarm Protocol"| Specialists
    Specialists <-->|"Queries Knowledge"| FileSearch
    Specialists -->|"Invokes Heavy Tasks"| FF
    
    FF -->|"Video/Image Gen"| Vertex
    FF <-->|"Reads/Writes User Tier"| FS
    FF -->|"Stores Assets"| CS
    
    SA -->|"Subscription Init"| Stripe
    Stripe -->|"Async Webhook"| FF

    %% Styling
    style LP fill:#00D4FF,color:#000
    style SA fill:#00D4FF,color:#000
    style ES fill:#00D4FF,color:#000

    style ZS fill:#8A2BE2,color:#FFF
    style AS fill:#8A2BE2,color:#FFF
    style AR fill:#8A2BE2,color:#FFF

    style LA fill:#8A2BE2,color:#FFF
    style MA fill:#8A2BE2,color:#FFF
    style BA fill:#8A2BE2,color:#FFF
    style CA fill:#8A2BE2,color:#FFF
    style RA fill:#8A2BE2,color:#FFF
    style FA fill:#8A2BE2,color:#FFF
    style MuA fill:#8A2BE2,color:#FFF

    style FF fill:#FF8C00,color:#000
    style FS fill:#FF8C00,color:#000
    style CS fill:#FF8C00,color:#000
    
    style Vertex fill:#39FF14,color:#000
    style FileSearch fill:#39FF14,color:#000

    style Stripe fill:#FF00FF,color:#FFF
```

## Transition Breakdown

1. **User Entry & Interaction:**
   Users enter the platform via the **Landing Page (LP)** and transition to the **Studio Web App (SA)**. Alternatively, they use the **Electron Desktop Shell (ES)**, which wraps the Studio app natively. The Studio dispatches UI events to the **Zustand Global Store (ZS)** and forwards complex AI requests to the **AgentService (AS)**.

2. **Context Injection & Orchestration:**
   The **AgentService (indii Agent Zero)** retrieves the current brand kit, user tier, and project metadata from the **Zustand Global Store (ZS)**. Before delegating tasks, it consults the **Agent Registry (AR)** to discover available specialist capabilities.

3. **Delegation & Swarm Collaboration:**
   The Orchestrator delegates the problem to the appropriate **Specialist Agent** (e.g., Creative, Legal, Finance). Once initiated, specialists can communicate directly with each other via the **A2A Swarm Protocol** without returning to the Orchestrator. 

4. **Knowledge Retrieval:**
   To inform their decisions and maintain project memory, Specialist Agents query the **Gemini File Search API (FileSearch)** natively, replacing the legacy RAG systems and ensuring long-context persistence.

5. **Heavy Task Offloading:**
   For high-compute operations like video and image generation, agents do not rely on client-side AI. They invoke **Firebase Functions (FF)**. 

6. **Cloud Execution & Persistence:**
   The Cloud Functions act as the secure backend barrier. They verify user quotas via the **Firestore Database (FS)** before triggering generation on **Vertex AI (Vertex)**. Once assets are generated, they are securely saved to **Cloud Storage (CS)** and referenced back in Firestore.

7. **Billing Lifecycle:**
   When a user initiates an upgrade from the UI, it routes to **Stripe Checkout (Stripe)**. Stripe processes the payment and fires an async webhook to **Firebase Functions (FF)**, securely updating the user's tier in the **Firestore Database (FS)**, which propagates live to the client state to unlock features immediately.
