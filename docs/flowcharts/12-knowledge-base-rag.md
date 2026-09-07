---
description: Architectural map of the Knowledge Base Retrieval-Augmented Generation (RAG) system, outlining the Cloud Functions proxy, local-environment fallback protections, and dual entry surfaces.
---

# Knowledge Base RAG Architecture

This flowchart tracks how natural language queries within the Knowledge Base system are parsed, vectorized, and retrieved against the document corpus. Elevated to the top-level **"Swarm Intelligence & Automations"** cluster alongside Boardroom and Agent Canvas, and accessible via a persistent **RightPanel slide-over** across all departments, it details the routing logic and backend retrieval protections (ISSUE-039) preventing clients from querying dead localhost proxy endpoints.

```mermaid
graph TD
    %% ╔══════════════════════════════════════════╗
    %% ║        KNOWLEDGE BASE ENTRY SURFACES     ║
    %% ╚══════════════════════════════════════════╝
    subgraph UI ["Knowledge Base Dual Access Surfaces"]
        NAV_CLUSTER["Swarm Intelligence Cluster (Full Module View)"]
        RIGHT_PANEL["Cross-Department RightPanel Slide-Over"]
        SEARCH_INPUT["User Query: 'How does mastering work?'"]
        RESULTS["RAG Answer & Document Citations"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        RETRIEVAL SERVICE                 ║
    %% ╚══════════════════════════════════════════╝
    subgraph SERVICE ["🔍 GeminiRetrievalService"]
        direction TB
        ENV_CHECK{"VITE_RAG_PROXY_URL<br/>is localhost?"}
        ROUTE_LOCAL["Local Dev Server<br/>(http://localhost:3001)"]
        ROUTE_PROD["Firebase Cloud Function<br/>(ragProxy/v1beta)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        RAG PROXY & VECTOR SEARCH         ║
    %% ╚══════════════════════════════════════════╝
    subgraph BACKEND ["☁️ Backend RAG Engine"]
        PROXY["RAG Proxy Endpoint"]
        EMBED["Generate Embeddings<br/>(Vertex AI text-embedding)"]
        VECTOR_DB["Vector Database Search<br/>(Firestore Vector Search, SDK-dependent)"]
        LLM["Contextual Synthesis<br/>(Gemini 3 Pro)"]
    end

    %% Connections
    NAV_CLUSTER --> SEARCH_INPUT
    RIGHT_PANEL --> SEARCH_INPUT
    SEARCH_INPUT --> ENV_CHECK
    
    ENV_CHECK -->|Yes and in dev| ROUTE_LOCAL
    ENV_CHECK -->|No or forced Prod| ROUTE_PROD
    
    ROUTE_LOCAL --> PROXY
    ROUTE_PROD --> PROXY
    
    PROXY --> EMBED
    EMBED --> VECTOR_DB
    VECTOR_DB -->|Context Chunks| LLM
    LLM --> RESULTS

    classDef ui fill:#00D4FF,stroke:#0077AA,stroke-width:2px,color:#001018
    classDef svc fill:#8B5CF6,stroke:#6D28D9,stroke-width:2px,color:#FFFFFF
    classDef backend fill:#FB923C,stroke:#C2410C,stroke-width:2px,color:#001018

    class NAV_CLUSTER,RIGHT_PANEL,SEARCH_INPUT,RESULTS ui
    class ENV_CHECK,ROUTE_LOCAL,ROUTE_PROD svc
    class PROXY,EMBED,VECTOR_DB,LLM backend
```

## Step-by-Step Transition Breakdown

1. **Dual Entry Access Surfaces:** The Knowledge Base is accessible via two native surfaces:
   - **Swarm Intelligence Cluster:** A dedicated full-page module elevated into the top-level "Swarm Intelligence & Automations" sidebar group alongside Boardroom and Agent Canvas.
   - **RightPanel Slide-Over:** A persistent slide-over drawer accessible from any department (Creative, Distribution, Finance, Marketing) enabling instant context lookups without navigating away from the active workflow.
2. **Query Initiation:** The user submits a question or query into the search bar from either surface.
3. **Environment Protection (ISSUE-039):** The `GeminiRetrievalService` evaluates the current environment configuration. The service explicitly detects localhost URLs and automatically routes to the production Cloud Function endpoint (`ragProxy/v1beta`) when the client is not actively running in local development mode.
4. **Endpoint Routing:** The query payload is securely dispatched to the active RAG Proxy endpoint.
5. **Vectorization:** The backend uses Vertex AI text-embedding models to convert the user's natural language query into a high-dimensional vector.
6. **Similarity Search:** The query vector is compared against pre-computed document embeddings stored in the Vector Database (Firestore Vector Search). The system retrieves the top *K* most semantically relevant text chunks.
7. **Synthesis & Citation:** The retrieved contextual chunks are bundled with the query and sent to Gemini 3 Pro, which synthesizes a factual, cited response returned to the active UI surface (full view or slide-over).
