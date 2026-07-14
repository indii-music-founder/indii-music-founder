# Judgment Layer — macro flow

Behavioral constraint layer for the in-product specialist agents: scope discipline, stop-when-done, verbosity cap, and a user-owned ambition dial. See the approved plan for full detail.

```mermaid
flowchart TD
    U[User message] --> CP[ContextPipeline.buildContext]
    CP -->|reads userProfile.preferences.agentAmbition| AL[ambitionLevel: focused / balanced / ideas]
    AL --> CTX[AgentContext.ambitionLevel]

    CTX --> BA[BaseAgent._executeInternal]
    BA --> APB[AgentPromptBuilder.buildFullPrompt]
    APB --> EC[buildExecutionContract level]
    EC -->|SCOPE + DONE + LENGTH rules,\ninjected after SUPERPOWER_PROMPT| FP[fullPrompt]

    FP --> LOOP{iterations < maxIterations?}
    LOOP -->|yes| GEN[generateContent/Stream\nmaxOutputTokens: 8192 default]
    GEN -->|tool calls| LOOP
    GEN -->|text only| DONE[Return final response]
    LOOP -->|iterations == maxIterations| NUDGE["[SYSTEM — FINAL STEP] nudge"]
    NUDGE --> GEN

    GEN -->|consult_specialist tool call| SW[SwarmTools.consult_specialist]
    SW --> HS[validateHubAndSpoke]
    HS --> DD[DelegationLoopDetector.recordDelegation]
    DD -->|depth >= 4 or repeat target| ERR[toolError DELEGATION_LOOP]
    DD -->|ok| A2A[A2AClient invoke/stream to target agent]

    subgraph "Server relay mirror"
        REL[getAgentPrompt agentId] --> RELEC[condensed EXECUTION_CONTRACT\nappended, balanced level]
    end

    subgraph "Settings"
        SET[Ambition dial UI] --> PROF[profileSlice.updatePreferences]
        PROF -->|persists| CP
    end
```

## Notes
- **Single injection point:** `AgentPromptBuilder.buildFullPrompt` is the only assembly choke point for every agent execution (client-side), so the Execution Contract lands there once — not duplicated per agent persona.
- **Fine-tuned agents:** the full prompt (contract included) rides as user content into fine-tuned Vertex endpoints — no retraining needed for the constraint to take effect.
- **Ambition dial:** user preference → `ContextPipeline` → `AgentContext.ambitionLevel` → contract wording (0/2/4 offered ideas). No silent auto-tuning; growth is consent-based (deferred v1.5 roadmap item, not built now).
- **A2A hop cap:** `consult_specialist` now shares `DelegationLoopDetector` with `delegate_task`, closing the previously uncapped swarm-delegation path.
- **Server relay** (`packages/firebase/src/relay/agentPrompts.ts`) is hand-synced by existing convention and ships a fixed "balanced" contract (no profile access there).
