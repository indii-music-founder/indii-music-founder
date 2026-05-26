# Core Pipeline Architecture

This document maps the newly implemented five-phase core agent development pipeline (`/start` -> `/proceed` -> `/skill-skill` -> `/middle` -> `/end`) and its integrations with sub-commands and tools.

```mermaid
graph TD
    A["User Request"] --> B{"Session Phase"}
    
    %% Start Phase
    B -->|New Feature / Chat| C["/start (Genesis Workflow)"]
    C --> C1["Environment Scan (git status, branch)"]
    C --> C2["/opp (Operator Audit)"]
    C --> C3["/flowchart (Macro Architecture Diagram)"]
    C3 --> C4["Save to docs/flowcharts/"]
    C --> C5["Determine Tools (/tdd, /to-issues)"]
    
    %% Proceed Phase
    B -->|Resume / Continue| P["/proceed (Resume & Audit Gate)"]
    P --> P1["Context Sync (checkpoints, task.md)"]
    P --> P2["Git Diff Audit"]
    P --> P3["Hard Compliance Scan (Anti-Laziness, Secrets, CSS)"]
    P --> P4["Gap-Filling Analysis"]

    %% Skill-Skill Routing Phase
    B -->|Anytime Question / Guidance| S["/skill-skill (Intelligent Skill Router)"]
    S --> S1["Goal & Task Assessment"]
    S --> S2["Scan Manifests (WIIL-skill) & Skills Inventory"]
    S --> S3["Apply Priority Routing Decision Matrix"]
    S --> S4["Output Standardized Routing Recommendation"]
    
    %% Middle Phase
    B -->|Active Execution| D["/middle (Execution Engine)"]
    D --> D1["Read task.md & Plan"]
    D --> D2["/go (Recursive Execution Loop)"]
    D2 --> D3{"Task Blocked?"}
    D3 -->|Yes| D4["Check ERROR_LEDGER & Apply Fix"]
    D3 -->|No| D5["Update task.md"]
    D --> D6["/flowchart (Micro Logic Diagram & Self-Healing Loop)"]
    D6 --> D7["Save to docs/flowcharts/"]
    
    %% End Phase
    B -->|Wrap Up| E["/end (Closing Protocol)"]
    E --> E1["Smart Finalization (Check against Prompt)"]
    E --> E2["Standardized Closing (Notes & Checkpoints)"]
    E2 --> E3["Write to .agent/checkpoints/"]
    E --> E4["/flowchart (Final Update)"]
    E4 --> E5["Save to docs/flowcharts/"]
    E --> E6["/ci-validate (The Gauntlet)"]
    E6 --> E7["Auto-fix, Hunter Scan, CI Tests"]
    E7 --> E8["Clean Repository Ready"]

    style A fill:#e0f7fa,stroke:#00acc1,stroke-width:2px
    style C fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    style P fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    style S fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    style D fill:#efebe9,stroke:#6d4c41,stroke-width:2px
    style E fill:#efebe9,stroke:#ff8f00,stroke-width:2px
    style C4 fill:#39FF14,stroke:#228B22,stroke-width:2px
    style D7 fill:#39FF14,stroke:#228B22,stroke-width:2px
    style E5 fill:#39FF14,stroke:#228B22,stroke-width:2px
    style E8 fill:#00D4FF,stroke:#00acc1,stroke-width:2px
```

## Step-by-Step Transition Breakdown

1. **User Action to Routing (`A -> B`):** The agent identifies the context. If it's a new feature, it runs `/start`. If resuming, it runs `/proceed`. If seeking tools or has a question, `/skill-skill`. If building, `/middle`. If wrapping up, `/end`.
2. **Start Phase (`C`):** 
   - `C1` & `C2` ensure the agent isn't building on a broken branch and has full context. 
   - `C3` ensures a macro-level diagram is planned *before* coding.
3. **Proceed Phase (`P`):**
   - Synchronizes checkpoint state (`P1`) and reviews diffs (`P2`).
   - Ensures strict compliance checks (`P3`) run immediately to avoid coding on top of lazy code or bad formatting.
4. **Skill-Skill Router Phase (`S`):**
   - Evaluates high-level tasks and matches them to manifests and underlying skill files (`S1 -> S2`).
   - Resolves the exact best tool to run and outputs prioritized guidance blocks (`S3 -> S4`).
5. **Middle Phase (`D`):**
   - `D2` uses `/go` for autonomous task loop processing.
   - Blockers `D3` trigger automatic ledger lookups (`D4`) to self-heal.
   - `D6` maps technical complexities (like state transitions) as they are built, running the new self-healing loop to verify Mermaid syntax and codebase pathing before compilation.
6. **End Phase (`E`):**
   - Validates all tasks and deliverables (`E1`).
   - Ensures memory preservation via Checkpoints (`E2`).
   - Finishes with the `/ci-validate` gauntlet (`E6`) to guarantee a pristine, bug-free codebase before sign-off.
