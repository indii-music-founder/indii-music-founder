# Slash Command Operating Loop

This flowchart maps how the local slash-command workflow files coordinate a normal agent session: initialization, execution, elevation, final verification, and feedback.

```mermaid
graph TD
    User["User invokes slash command"] --> Router["AGENTS.md slash workflow router"]
    Router --> Start["/start context assessment"]
    Start --> Opp["/opp operator scan"]
    Start --> FlowMacro["/flowchart macro diagram"]
    Start --> Middle["/middle execution engine"]
    Middle --> Go["/go single-task loop"]
    Go --> LedgerGate["Active task ledger guard"]
    LedgerGate --> CurrentGoal["Current user objective"]
    LedgerGate --> AgentArtifacts[".agent/artifacts task and plan"]
    LedgerGate --> RootLedger["Root task.md only if matching"]
    Go --> Better["/better elevation pass"]
    Better --> CommandAudit["Workflow clarity and structural audit"]
    CommandAudit --> Go
    Go --> End["/end closing protocol"]
    End --> FinalFlow["/flowchart final diagram update"]
    End --> Validate["/ci-validate or equivalent validation gate"]
    Validate --> Feedback["Command feedback and completion evidence"]

    style User fill:#e0f7fa,stroke:#00acc1,stroke-width:2px
    style Router fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    style Start fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style Middle fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style Go fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
    style Better fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    style End fill:#ede7f6,stroke:#5e35b1,stroke-width:2px
    style Validate fill:#ffebee,stroke:#c62828,stroke-width:2px
```

## Transition Breakdown

1. A user command is routed through `AGENTS.md`, which points slash commands to `.agent/workflows/`.
2. `/start` performs the beginning-of-session classification and calls `/opp` for repo, handoff, memory, workflow, and dependency awareness.
3. `/start` also requires a saved `/flowchart` artifact, so this document records the macro command flow.
4. `/middle` takes over during active execution and delegates one concrete task at a time to `/go`.
5. `/go` now checks for stale task ledgers before using root `task.md` or `implementation_plan.md`, preventing unrelated old work from steering the session.
6. `/better` audits the current target through structural and clarity lenses, then feeds safe workflow fixes back into `/go`.
7. `/end` verifies the current objective, records closing evidence, updates architecture diagrams when needed, and calls the final validation path.
8. The session closes with explicit feedback and command-by-command evidence instead of relying on broad claims.
