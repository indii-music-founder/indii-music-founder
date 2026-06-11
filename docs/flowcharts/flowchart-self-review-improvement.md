# Flowchart Self-Review and Self-Healing Architecture

This diagram maps the new "Self-Review and Self-Healing" flow within the `/flowchart` command. It details how the agent identifies conceptual gaps, checks Mermaid syntax validity, and automatically repairs mistakes.

```mermaid
graph TD
    A["Initiate Flowchart Gen"] --> B["Step 1: Map Codebase Nodes"]
    B --> C["Step 2: Construct Draft Mermaid Syntax"]
    
    %% Self-Healing Loop
    C --> D["Step 3: Self-Review & Verification Gate"]
    D --> D1{"Syntax Check?"}
    D1 -->|Errors found| E["Phase A: Auto-Syntax Repair"]
    E -->|Quote special chars / Fix brackets| C
    
    D1 -->|Syntax OK| D2{"Logic & Trace Check?"}
    D2 -->|Orphan nodes / Illogical flow| F["Phase B: Semantic Alignment"]
    F -->|Re-verify codebase files & import chains| B
    
    D2 -->|Logic OK| D3{"File Reference Check?"}
    D3 -->|Non-existent files mapped| G["Phase C: Correct Pathing"]
    G -->|Update targets with real absolute/relative paths| B
    
    D3 -->|All OK| H["Step 4: Finalize Diagram Output"]
    H --> I["Step 5: Write to docs/flowcharts/"]

    style A fill:#e0f7fa,stroke:#00acc1,stroke-width:2px
    style D fill:#efebe9,stroke:#ff8f00,stroke-width:2px
    style D1 fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    style D2 fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    style D3 fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    style E fill:#FF00FF,stroke:#8A2BE2,stroke-width:2px
    style F fill:#FF00FF,stroke:#8A2BE2,stroke-width:2px
    style G fill:#FF00FF,stroke:#8A2BE2,stroke-width:2px
    style I fill:#39FF14,stroke:#228B22,stroke-width:2px
```

## Step-by-Step Transition Breakdown

1. **Syntax Integrity Verification (`D1 -> E -> C`):** The agent runs a quick regex/lint audit on the generated Mermaid code. If brackets are unclosed, or node IDs have unquoted special characters (e.g. `(`, `)`, `-`), `Phase A` fires to clean syntax before compile.
2. **Semantic Verification (`D2 -> F -> B`):** The agent reviews the trace. Do nodes hang without inputs or outputs? Does the flow represent a logical request/response cycle? If not, `Phase B` aligns the diagram to match actual directory execution.
3. **Absolute File Verification (`D3 -> G -> B`):** Mapped codebase files (e.g. `packages/renderer/src/services/UserService.ts`) are cross-referenced with the filesystem. If they are non-existent, `Phase C` updates them.
4. **Final Registry Write (`I`):** The final polished, error-free flowchart is saved strictly inside `docs/flowcharts/` for maximum searchability by the swarm.
