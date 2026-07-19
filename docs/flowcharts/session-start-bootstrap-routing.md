# Session Start Bootstrap & Routing

This flowchart captures the repo-local `/start` initialization path for a fresh session: sync git state, scan the operator context, note the current health-baseline limitation, and route into the next concrete task or workflow.

```mermaid
flowchart TD
    U["User invokes /start"] --> S["start.md bootstrap workflow"]
    S --> G["/get-git sync and validation"]
    G --> O["/opp operator status scan"]
    O --> H["Health baseline check /health"]
    H --> M{"Task specified?"}
    M -->|No| Q["Ask for exact feature, bug, or workflow"]
    M -->|Yes| R{"Extra workflow needed?"}
    R -->|Yes| F["/flowchart architecture map saved under docs/flowcharts/"]
    R -->|No| T["Route directly to execution workflow"]
    F --> T
    T --> X["Proceed to /middle, /go, /review, or a skill"]

    style U fill:#00d4ff,stroke:#0077b6,stroke-width:2px,color:#001219
    style S fill:#8a2be2,stroke:#5a189a,stroke-width:2px,color:#ffffff
    style G fill:#39ff14,stroke:#2d6a4f,stroke-width:2px,color:#06210c
    style O fill:#ff8c00,stroke:#d97706,stroke-width:2px,color:#1f1300
    style H fill:#f59e0b,stroke:#b45309,stroke-width:2px,color:#1f1300
    style Q fill:#ff4d6d,stroke:#c9184a,stroke-width:2px,color:#ffffff
    style F fill:#8a2be2,stroke:#5a189a,stroke-width:2px,color:#ffffff
    style T fill:#22c55e,stroke:#15803d,stroke-width:2px,color:#ffffff
    style X fill:#0ea5e9,stroke:#0369a1,stroke-width:2px,color:#ffffff
```

## Transition Breakdown

1. The session begins when the user issues `/start`, which activates the repo-local bootstrap workflow in `.agent/workflows/start.md`.
2. `/get-git` runs first so the branch state, remote sync state, and validation posture are known before any task work begins.
3. `/opp` then captures the operator snapshot: branch, clean/dirty status, recent commits, workflow inventory, handoff artifacts, error patterns, and memory presence.
4. The health baseline step is recorded as a manual/planned check in this repo, so the chart preserves the intent without pretending there is an automated `/health` implementation here.
5. If the user's request is still underspecified after the bootstrap scan, the session pauses and asks for the exact feature, bug, or workflow to pursue.
6. If the request is clear, the session checks whether another workflow is needed, such as `/review`, `/middle`, `/go`, or a domain skill.
7. If architecture mapping is needed, `/flowchart` writes the current strategy diagram into `docs/flowcharts/` before execution continues.
8. Once routing is settled, the session hands off into the next execution surface and proceeds with the concrete task instead of staying in bootstrap mode.
