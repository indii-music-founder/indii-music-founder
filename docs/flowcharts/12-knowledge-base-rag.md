---
description: Architectural map of the Knowledge Base Retrieval-Augmented Generation (RAG) system, outlining the Cloud Functions proxy and local-environment fallback protections.
---

# Knowledge Base RAG Architecture

This flowchart tracks how natural language queries within the Knowledge Base module are parsed, vectorized, and retrieved against the document corpus. Following ISSUE-039, it specifically highlights the routing logic that prevents production clients from attempting to query dead localhost proxy servers.

```mermaid
graph TD
    %% ╔══════════════════════════════════════════╗
    %% ║        KNOWLEDGE BASE UI                 ║
    %% ╚══════════════════════════════════════════╝
    subgraph UI ["🖥️ Knowledge Base UI"]
        SEARCH_INPUT["User: 'How does mastering work?'"]
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
        VECTOR_DB["Vector Database Search<br/>(Firestore Vector Search)"]
        LLM["Contextual Synthesis<br/>(Gemini 3 Pro)"]
    end

    %% Connections
    SEARCH_INPUT --> ENV_CHECK
    
    ENV_CHECK -->|Yes (and in dev)| ROUTE_LOCAL
    ENV_CHECK -->|No (or forced Prod)| ROUTE_PROD
    
    ROUTE_LOCAL --> PROXY
    ROUTE_PROD --> PROXY
    
    PROXY --> EMBED
    EMBED --> VECTOR_DB
    VECTOR_DB -->|Context Chunks| LLM
    LLM --> RESULTS

    classDef ui fill:#00D4FF,stroke:#0077AA,stroke-width:2px,color:#001018
    classDef svc fill:#8B5CF6,stroke:#6D28D9,stroke-width:2px,color:#FFFFFF
    classDef backend fill:#FB923C,stroke:#C2410C,stroke-width:2px,color:#001018

    class SEARCH_INPUT,RESULTS ui
    class ENV_CHECK,ROUTE_LOCAL,ROUTE_PROD svc
    class PROXY,EMBED,VECTOR_DB,LLM backend
```

## Transition Breakdown

1. **Query Initiation**: The user types a question into the Knowledge Base search bar.
2. **Environment Protection (ISSUE-039)**: The `GeminiRetrievalService` evaluates the current environment configuration. Previously, a stale `.env.example` led to production builds attempting to hit `http://localhost:3001` (crashing the fetch). The service now explicitly detects localhost URLs and automatically falls back to the production Cloud Function endpoint (`ragProxy/v1beta`) if the client is not actively in development mode.
3. **Endpoint Routing**: The query payload is securely dispatched to the chosen RAG Proxy endpoint.
4. **Vectorization**: The backend uses Vertex AI text-embedding models to convert the user's natural language query into a mathematical vector.
5. **Similarity Search**: The query vector is compared against the pre-computed document embeddings stored in the Vector Database (Firestore Vector Search integration). The system retrieves the top *K* most semantically similar text chunks.
6. **Synthesis**: The retrieved contextual chunks are bundled with the original query and sent to the Gemini 3 Pro LLM, which synthesizes a precise, cited answer. The final text block and document links are returned to the UI.
