---
description: The complete pipeline for creative media production, mapping the deterministic vector canvas manipulation versus the probabilistic generative AI routes, including performance optimizations for asset loading.
---

# Creative Production Pipeline

This flowchart outlines the dual-track nature of the Creative Studio. It clearly delineates the difference between deterministic UI manipulations (vector shapes via `CanvasTools`) and probabilistic generative media requests (via `MediaTools`), while highlighting the off-thread decompression optimizations (ISSUE-026) and strict Z-Index bounding constraints (ISSUE-035).

```mermaid
graph TD
    %% ╔══════════════════════════════════════════╗
    %% ║        CREATIVE DIRECTOR INPUT           ║
    %% ╚══════════════════════════════════════════╝
    REQ["User: 'Draw a blue square'<br/>vs.<br/>'Generate a picture of a blue square'"]

    %% ╔══════════════════════════════════════════╗
    %% ║        AGENT SEMANTIC ROUTING            ║
    %% ╚══════════════════════════════════════════╝
    subgraph AGENT ["🤖 Creative Agent Routing"]
        SEMANTIC{"Semantic Tool Intent"}
        T_CANVAS["CanvasTools<br/>(Deterministic UI)"]
        T_MEDIA["MediaTools<br/>(Probabilistic GenAI)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        DETERMINISTIC TRACK (FABRIC.JS)   ║
    %% ╚══════════════════════════════════════════╝
    subgraph DETERMINISTIC ["📐 Vector / UI Manipulation"]
        Z_LIMIT{"Z-Index > 1000?"}
        CEILING["Clamp to MAX_Z_INDEX (1000)"]
        RENDER_VEC["Fabric.js renderAll()"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        PROBABILISTIC TRACK (GEN-AI)      ║
    %% ╚══════════════════════════════════════════╝
    subgraph PROBABILISTIC ["🎨 Generative AI Execution"]
        API["Nano Banana API<br/>(gemini-3-pro-image)"]
        STORE["Upload to Cloud Storage<br/>(Returns URI)"]
        DECOMPRESS["Off-thread Image Decompression<br/>(await htmlImg.decode)"]
        RENDER_IMG["Fabric.js Image.fromURL()"]
    end

    %% Connections
    REQ --> SEMANTIC
    SEMANTIC -->|'Draw/Shape/UI'| T_CANVAS
    SEMANTIC -->|'Generate/Imagine/Photo'| T_MEDIA

    %% Deterministic Flow
    T_CANVAS --> Z_LIMIT
    Z_LIMIT -->|Yes| CEILING
    Z_LIMIT -->|No| RENDER_VEC
    CEILING --> RENDER_VEC

    %% Probabilistic Flow
    T_MEDIA --> API
    API --> STORE
    STORE --> DECOMPRESS
    DECOMPRESS --> RENDER_IMG

    classDef req fill:#00D4FF,stroke:#0077AA,stroke-width:2px,color:#001018
    classDef agent fill:#E11D48,stroke:#9F1239,stroke-width:2px,color:#FFFFFF
    classDef det fill:#F472B6,stroke:#DB2777,stroke-width:2px,color:#001018
    classDef prob fill:#A78BFA,stroke:#7C3AED,stroke-width:2px,color:#001018

    class REQ req
    class SEMANTIC,T_CANVAS,T_MEDIA agent
    class Z_LIMIT,CEILING,RENDER_VEC det
    class API,STORE,DECOMPRESS,RENDER_IMG prob
```

## Transition Breakdown

1. **Semantic Routing (ISSUE-036)**: The Creative Agent receives a prompt. Due to strictly clarified system descriptions, it parses deterministic requests (e.g., adding text, changing UI background color, drawing vector rectangles) to `CanvasTools`, and creative imaginative requests to `MediaTools`.
2. **Deterministic Track (CanvasTools)**: 
    - The tool payload dictates a shape operation.
    - **Z-Index Safeguard (ISSUE-035)**: Before drawing, the parameters are checked against a strict `MAX_Z_INDEX` (1000). If the LLM hallucinates `z: 999999` (which would permanently lock the user out of the UI), it is safely clamped.
    - Fabric.js executes the deterministic DOM/Canvas manipulation.
3. **Probabilistic Track (MediaTools)**:
    - The generative prompt is dispatched to the Nano Banana API (utilizing `gemini-3-pro-image`).
    - The resulting raw image buffer is uploaded to Firebase Cloud Storage, which returns a secure URI.
    - **Performance Optimization (ISSUE-026)**: Instead of locking the main UI thread while Fabric.js decompresses the base64/URI image data synchronously, the pipeline uses an off-thread `await htmlImg.decode()` helper.
    - Once decompressed in the background, the pre-computed raster data is injected into the Fabric.js canvas without causing UI stutter or jank.
