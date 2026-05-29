# Universal Harness Compiler Architecture Flowchart

This flowchart maps the non-negotiable core architecture that all 22 Business Harnesses must follow. It details the linear, deterministic pipeline from generic compilation requests through the Domain Compiler, and out into a normalized `HarnessRun` payload.

```mermaid
graph TD
    %% Entry Layer
    subgraph Core ["Shared Core (packages/shared/business-harness)"]
        CompileEntry["`compileHarness(domain, input, ctx)`"]
        Registry["HarnessRegistry (Maps Domain -> Compiler)"]
    end

    %% Pipeline Layer
    subgraph Pipeline ["Domain Compiler Pipeline (e.g. SongDnaCompiler)"]
        Adapter["1. Input Adapter (Reads app data/context)"]
        Compiler["2. Domain Compiler (Deterministic logic & AI extraction)"]
        Builder["3. HarnessRun Builder (`createHarnessRun`)"]
    end

    %% Storage Layer
    subgraph Storage ["Persistence"]
        HarnessStore["Shared HarnessStorage (Firestore)"]
        DomainStore["Domain-Specific Storage (Optional)"]
    end

    %% Normalized Output
    subgraph Output ["Normalized HarnessRun Output"]
        Scores["Scores & Findings"]
        CostLines["Cost Lines & Business Activity"]
        LegalBasis["Legal Basis & Evidence Refs"]
        Briefs["Agent Briefs (Owner & Supporters)"]
        ApprovalGates["Approval Gates (Irreversible Actions)"]
        Schema["`schemaVersion` (Migration Safety)"]
    end

    %% Transitions
    CompileEntry -->|"Validates Request"| Registry
    Registry -->|"Resolves Specific Compiler"| Adapter
    
    Adapter -->|"Normalizes Input"| Compiler
    Compiler -->|"Executes Rules, AI, Blockers"| Builder
    
    Builder -->|"Attaches Shared Metadata"| Schema
    Builder -->|"Formats Payload"| Scores
    Builder -->|"Computes Expected Costs"| CostLines
    Builder -->|"Embeds Law/Source Context"| LegalBasis
    Builder -->|"Constructs Persona Context"| Briefs
    Builder -->|"Blocks Execution without User"| ApprovalGates
    
    Builder -->|"Saves Historical Run"| HarnessStore
    Compiler -.->|"Saves specific domain assets"| DomainStore

    %% Styling
    style CompileEntry fill:#00D4FF,color:#000
    style Registry fill:#8A2BE2,color:#FFF

    style Adapter fill:#FF00FF,color:#FFF
    style Compiler fill:#FF00FF,color:#FFF
    style Builder fill:#FF00FF,color:#FFF

    style HarnessStore fill:#39FF14,color:#000
    style DomainStore fill:#39FF14,color:#000

    style Scores fill:#FF8C00,color:#000
    style CostLines fill:#FF8C00,color:#000
    style LegalBasis fill:#FF8C00,color:#000
    style Briefs fill:#FF8C00,color:#000
    style ApprovalGates fill:#FF8C00,color:#000
    style Schema fill:#FF8C00,color:#000
```

## Transition Breakdown

1. **Compilation Request:** A system event (e.g., uploading a song) calls the universal entry point **`compileHarness(domain, input, ctx)`**. 
2. **Compiler Resolution:** The system queries the **HarnessRegistry** to verify the requested domain exists and fetches the exact compiler class (e.g., `SongDnaCompiler`).
3. **Input Adaptation:** The **Input Adapter** reads existing app state and user context, ensuring that no irreversible actions are taken. It normalizes this data into the specific compiler's input structure.
4. **Domain Compilation:** The **Domain Compiler** performs the heavy lifting. This involves deterministic checks, scoring, identifying blockers, and assessing readiness. AI is used strictly for extraction, classification, or summarization—never for hallucinatory state changes.
5. **Normalized Run Building:** The output is passed to the **HarnessRun Builder** (`createHarnessRun`). This is the most critical step—it normalizes the domain's unique logic into a strict schema. It injects:
   - **`schemaVersion`:** To allow future migrations of historical database records safely.
   - **Agent Briefs:** Concise instructions tailored for the "Owning" agent and minimal context for "Supporting" agents.
   - **Approval Gates:** If the compiler detects an irreversible action (spending money, filing a legal notice, delivering a track to DSPs), it attaches a mandatory approval gate that blocks downstream MCP execution.
6. **Persistence:** The final, normalized `HarnessRun` is saved permanently to the shared **HarnessStorage** in Firestore. If the domain created unique standalone assets (like a raw mp3 file), it uses **Domain-Specific Storage**.
