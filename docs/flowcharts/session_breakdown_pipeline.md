# Session Breakdown & Long-Form Video Pipeline Architecture

> **Governing Directive:** Sequentially execute ISSUE-1175 $\rightarrow$ ISSUE-1176 $\rightarrow$ ISSUE-1177 $\rightarrow$ ISSUE-1178 $\rightarrow$ ISSUE-1179 $\rightarrow$ ISSUE-1180 $\rightarrow$ ISSUE-1181.

```mermaid
flowchart TD
    subgraph Ingestion["ISSUE-1175: Ingestion & Edit Proxy"]
        A[Raw iPhone Video / Audio] --> B[Resumable Private Upload]
        B --> C[720p H.264/AAC CFR Proxy + Microsecond Time Map]
        C --> D[Guide Audio + Waveform + Metadata]
    end

    subgraph Sync["ISSUE-1176: Master Audio Alignment"]
        D --> E[Multi-Window DSP Alignment Worker]
        Master[Immutable Canonical Master WAV/FLAC] --> E
        E --> F[MasterSyncAlignment Receipt: Confidence, Drift, Anchors]
    end

    subgraph Analysis["ISSUE-1177: Transcription & Edit Plan"]
        F --> G[Deterministic VAD + Word-Level Transcript]
        G --> H[Vertex Gemini Struct Plan: Take & Scene Classification]
        H --> I[SessionEditPlan Receipt: Performance / Spoken / Candid / Blooper]
    end

    subgraph Processing["ISSUE-1178: Audio Recipes & Restoration"]
        I --> J[Audio Filter Graphs: Denoise, Leveling, Ambience Blend]
        J --> K[AudioRecipe & Processed Derivative Receipts]
    end

    subgraph Review["ISSUE-1179: Director's Cut Review Surface"]
        K --> L[Creative Video Studio: Session Breakdown UI]
        L --> M{Artist Review & Nudge}
        M -->|Approve Selects| N[ApprovalReceipt: Generational & Time Map Pinning]
    end

    subgraph Timeline["ISSUE-1180: Master Timeline Compiler"]
        N --> O[Compiler: Project-Scoped Timeline Revision]
        O --> P[Remotion Composition: Microsecond Source Ranges + Sync Lock]
    end

    subgraph Handoff["ISSUE-1181: Private Render & Derivative Handoff"]
        P --> Q[Server-Side Remotion/FFmpeg Private Render]
        Q --> R[Terminal DerivativeAssetReceipt: 9:16 / 1:1 / 16:9]
        R --> S[Typed Social/Campaign Draft Handoff]
    end
```

## Execution Sequence & Contract Guards

1. **ISSUE-1175 (Ingestion & Proxy)**: Establishes `CanonicalMediaRef`, `VideoSession`, and `ProxyManifest`.
2. **ISSUE-1176 (Master Alignment)**: Establishes `MasterSyncAlignment` anchored to `MasterTimingProfile`.
3. **ISSUE-1177 (Edit Plan)**: Establishes `SessionEditPlan` classifying performance/spoken/candid/bloopers without auto-deleting.
4. **ISSUE-1178 (Audio Recipes)**: Establishes `AudioRecipe` profiles (Natural, Clean, Studio, Rescue) and ambience ducking.
5. **ISSUE-1179 (Director's Cut UI)**: Establishes `ApprovalReceipt` binding user decisions to plan/sync/media generations.
6. **ISSUE-1180 (Timeline Compiler)**: Compiles `ApprovalReceipt` into project-scoped `videoEditorStore` timeline clips.
7. **ISSUE-1181 (Derivative Handoff)**: Produces terminal `DerivativeAssetReceipt` records and typed Social/Campaign drafts.
