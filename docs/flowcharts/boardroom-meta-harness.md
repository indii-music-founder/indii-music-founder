# Boardroom Meta-Harness Decision Engine Flowchart

This flowchart maps the `BoardroomMetaHarnessService`, which acts as the cross-domain reconciliation layer. It does not ingest raw user data; instead, it ingests an array of normalized `HarnessRun` objects to emit a final, multi-disciplinary business decision.

```mermaid
graph TD
    %% Input Sources (The Runs)
    subgraph HarnessRuns ["HarnessRun[] Array (Normalized Inputs)"]
        Release["Release HarnessRun (via Adapter)"]
        Legal["Creator Protection HarnessRun"]
        Finance["Finance & Activity HarnessRun"]
        Marketing["Marketing / Merch HarnessRun"]
        Distribution["Distribution / DDEX HarnessRun"]
    end

    %% The Engine
    subgraph MetaEngine ["BoardroomMetaHarnessService"]
        Ingestor["1. Run Ingestion & Aggregation"]
        Conflict["2. Conflict Detection Engine"]
        Reconciler["3. Priority Reconciler"]
        Builder["4. Decision Builder"]
    end

    %% The Output
    subgraph Output ["BoardroomHarnessDecision"]
        Status["Final Status (Approve / Defer / Block)"]
        Citations["Source Citations (Run IDs)"]
        Blockers["Escalated Blockers"]
        SummaryCosts["Aggregated Costs & ROI"]
        NextActions["Next Owner Actions"]
    end

    %% Data Flow
    Release --> Ingestor
    Legal --> Ingestor
    Finance --> Ingestor
    Marketing --> Ingestor
    Distribution --> Ingestor

    Ingestor -->|"Groups data by Cost, Risk, & Readiness"| Conflict

    Conflict -->|"Identifies Clashes (e.g. Marketing Urgency vs Legal Risk)"| Reconciler
    
    Reconciler -->|"Applies Business Weights & Overrides"| Builder

    Builder -->|"Emits Decision"| Status
    Builder -->|"Links directly back to sources"| Citations
    Builder -->|"Bubbles up fatal issues"| Blockers
    Builder -->|"Provides Executive Summary"| SummaryCosts
    Builder -->|"Assigns tasks to specific Agents"| NextActions

    %% Strict Rules
    subgraph Governance ["Strict Rules"]
        Rule1["Rule: Never invent facts. Only use provided HarnessRuns."]
        Rule2["Rule: Legal & Security Blockers ALWAYS override Optimism."]
    end

    Conflict -.-> Governance
    Reconciler -.-> Governance

    %% Styling
    style MetaEngine fill:#FF00FF,color:#FFF
    style Output fill:#FF8C00,color:#000
    style Governance fill:#FF3333,color:#FFF,stroke-dasharray: 5 5
```

## Transition Breakdown

1. **Ingestion & Aggregation:** The Meta-Harness accepts a flat array of `HarnessRun` objects. Because every domain uses the exact same schema (even older systems like Release which use a Wave 1 adapter), the Boardroom doesn't need domain-specific parsing logic.
2. **Conflict Detection:** The engine looks for conflicting signals across the runs. For example:
   - *Marketing* says "Greenlight the campaign, momentum is high."
   - *Legal* says "Missing collaborator split sheets, high risk."
   - *Finance* says "Insufficient budget for the proposed Merch drop."
3. **Priority Reconciliation:** The Reconciler applies strict business logic to resolve conflicts. As defined by the architecture, **Legal, Security, and Finance blockers always override Marketing or Creative optimism**. The system will not allow an illegal or unfunded action to pass, regardless of how ready the assets are.
4. **Decision Building:** The Meta-Harness constructs a final `BoardroomHarnessDecision`. It does not execute actions. It acts as an executive summary for the user and the Conductor Agent.
5. **Traceability (Citations):** A core rule of the Boardroom is that it *cannot invent facts*. Every claim, cost, or blocker in the final decision must contain a hard citation (the `runId`) linking back to the specific Domain Harness that generated it.
