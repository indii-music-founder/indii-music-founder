# Neural Cortex: Semantic Visual Memory Core Flowchart

This flowchart maps the `Neural Cortex`, a vector-based imagination system that ensures visual continuity (wardrobe, lighting, character traits) across long video/story sequences. It prevents visual "drift" by anchoring generated assets to canonical Show Bible entities rather than just referencing prior pixel outputs.

```mermaid
graph TD
    %% Input Layer
    subgraph DataIngest ["Ingestion & Context"]
        Bible["Show Bible (Characters, Props, Sets)"]
        DirectorBoard["Director's Board (Storyboards)"]
        BaseAssets["Exemplar Images / Sketches"]
    end

    %% Storage Layer
    subgraph CortexCore ["Neural Cortex (Vector Index)"]
        Profiles["Entity Profiles (Canonical Data)"]
        Embeddings["Multimodal Embeddings"]
        Anchors["Narrative Anchors (Time/Beat Tags)"]
        
        Profiles --- Embeddings
        Embeddings --- Anchors
    end

    %% Pipeline Layer
    subgraph Synthesis ["Prompt Synthesis & Retrieval"]
        Snapshot["1. Assemble Scene Graph Snapshot"]
        Directives["2. Build Render Directives (Prompts)"]
        Constraints["3. Inject Negative Constraints"]
    end

    %% Generation Layer
    subgraph Generation ["Renderer & Validation"]
        Renderer["Image / Video Model (e.g., Veo / Imagen)"]
        Output["Generated Frames"]
        DriftCheck["Drift Detection Pass"]
    end

    %% Transitions
    Bible & DirectorBoard & BaseAssets -->|"Seed semantic identity"| Profiles
    
    CortexCore -->|"Retrieve contextual entities"| Snapshot
    
    Snapshot -->|"Translate graph to"| Directives
    Snapshot -->|"Calculate expected state"| Constraints
    
    Directives --> Renderer
    Constraints --> Renderer
    
    Renderer --> Output
    Output -->|"Validate against Snapshot"| DriftCheck
    
    DriftCheck -.->|"PASS: Re-embed and Index"| Embeddings
    DriftCheck -.->|"FAIL: Auto-correct or Flag"| Synthesis

    %% Strict Rules
    subgraph Rules ["Authenticity & Continuity Rules"]
        R1["No mocked context: Must rely on real Show Bible assets"]
        R2["Provenance-first: Writes must track source asset IDs"]
        R3["Fail-closed: Missing assets block generation"]
    end
    CortexCore -.-> Rules

    %% Styling
    style DataIngest fill:#FF00FF,color:#FFF
    style CortexCore fill:#8A2BE2,color:#FFF
    style Synthesis fill:#00D4FF,color:#000
    style Generation fill:#39FF14,color:#000
    style Rules fill:#FF3333,color:#FFF,stroke-dasharray: 5 5
```

## Transition Breakdown

1. **Ingest & Contextualization:** Canonical data (like the Show Bible descriptions and approved character sketches) are ingested into the Cortex. This creates immutable `Entity Profiles` and seeds the multimodal vector `Embeddings`. These are tagged with `Narrative Anchors` (e.g., "Post-battle damage, Episode 3").
2. **Snapshot Assembly:** When a new shot is planned, the Cortex retrieves the specific embeddings for that narrative beat. It builds a `Scene Graph Snapshot` tracking who is in the scene, where they are, and what emotional tone or lighting is required.
3. **Synthesis:** The snapshot is translated into explicit `Render Directives` (prompts) and negative constraints. This ensures the rendering engine knows exactly what the character must look like in this exact point in time.
4. **Generation & Drift Check:** The model generates the frame. Before accepting it, a `Drift Detection Pass` compares the output back against the expected Scene Graph Snapshot. If the frame "drifted" (e.g., wrong jacket color, missing prop), it is rejected for automatic inpainting/correction or flagged for human review.
5. **Re-Indexing:** Only validated, approved frames are re-embedded back into the Cortex, ensuring that the system's memory stays perfectly aligned with the approved story timeline.
