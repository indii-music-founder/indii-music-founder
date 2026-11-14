---
description: The lifecycle of a user request mapping the Conductor DAG execution, A2A peer delegation, Business Harness MCP compilation, and state synchronization.
---

# Swarm Delegation Loop

This flowchart tracks what happens when a user asks the AI to accomplish a multi-step task. It traces the lifecycle from the UI keystroke, through the Conductor's capability mapping, into the decentralized A2A swarm, and finally down to deterministic Cloud Function executions and state syncs.

```mermaid
sequenceDiagram
    participant User
    participant UI as Studio UI
    participant Store as Zustand Store
    participant Chat as ChatOverlay
    participant Conductor as indii Conductor<br/>(AgentGraphService)
    participant Registry as Agent Registry
    participant Agent as Specialist Agent
    participant A2A as A2AClient
    participant Harness as Business Harness<br/>(MCP Server)
    participant Boardroom as Boardroom<br/>Meta-Harness
    participant AI as Gemini 3 Pro
    participant CF as Cloud Functions
    participant DB as Firestore
    participant Storage as Cloud Storage

    User->>UI: Types request in Chat
    UI->>Store: Update agentSlice (pending)
    UI->>Chat: Render user message
    Chat->>Conductor: Route request

    Conductor->>Registry: Query capabilities
    Registry-->>Conductor: Matching agent(s)
    Conductor->>Conductor: Build execution DAG

    loop For each DAG node
        Conductor->>Agent: Execute task
        Agent->>AI: Generate reasoning
        AI-->>Agent: Response + tool calls

        alt Needs cross-domain help
            Agent->>A2A: consult_specialist
            A2A->>Agent: Peer response
        end

        alt Needs deterministic state
            Agent->>Harness: compile_harness (MCP)
            Harness->>Harness: Run domain compiler
            Harness-->>Agent: HarnessRun + Gates

            alt Cross-domain conflict
                Agent->>Boardroom: create_boardroom_decision
                Boardroom->>Boardroom: Reconcile priorities
                Boardroom-->>Agent: Strategic decision
            end
        end

        alt Needs side effects
            Agent->>CF: Execute function
            CF->>DB: Read/Write data
            CF->>Storage: Upload assets
            CF-->>Agent: Result
        end

        Agent-->>Conductor: Node complete
    end

    Conductor->>Store: Update results
    Store->>UI: Re-render with results
    UI->>User: Display response + artifacts
    DB-.->Store: onSnapshot sync
```

## Transition Breakdown

1. **User Input to Conductor**: The user types a command. The UI updates the Zustand `agentSlice` to show a pending state and sends the prompt payload to the Conductor (`AgentGraphService`).
2. **Capability Matching**: The Conductor queries the `capability_registry.json` to map the semantic intent of the prompt to the specific domains of the seated agents. It constructs a Directed Acyclic Graph (DAG) for sequential or parallel execution.
3. **Agent LLM Inference**: For each node in the DAG, the designated Specialist Agent sends its system prompt and history to the Gemini 3 Pro endpoint, receiving a structured JSON response and tool calls.
4. **Peer-to-Peer Consultation (A2A)**: If the agent encounters a domain outside its expertise (e.g., Finance needs Legal's approval), it issues a `consult_specialist` tool call via the `A2AClient`, pausing its own execution until the peer returns a verdict.
5. **Deterministic Harness Compilation**: If the action modifies sensitive state (e.g., committing to a tour budget), the agent uses the `indii-harness` MCP server to compile a `HarnessRun`. This forces the LLM's probabilistic output into a strictly validated, human-gated payload.
6. **Boardroom Reconciler**: If the `HarnessRun` creates a cross-domain conflict (e.g., Marketing wants to spend $500, but Finance strictly enforces a $300 cap), the agent triggers a `create_boardroom_decision` in the Meta-Harness to resolve the priority conflict.
7. **Side Effects & Sync**: Standard side effects are executed via Cloud Functions, reading/writing to Firestore and Cloud Storage. The completion cascades back up the DAG to the Conductor.
8. **Final UI Render**: The Conductor pushes the aggregated results to the Zustand store. React re-renders the chat overlay, and Firestore's `onSnapshot` listeners automatically sync any underlying database changes back to the UI.


## AgentLoopService optional retry judgments

This execution-loop accounting path is separate from Boardroom's server-owned
`agent_stream` cost reservations. It applies to TypeSafe retry classification
after an action or evaluation failure.

```mermaid
flowchart TD
    ERROR["Action or evaluation failure"] --> FLAG{"Judgments available?"}
    FLAG -->|No| BASELINE["Deterministic retry heuristic"]
    FLAG -->|Yes| HOLD{"Reserve remaining execution allowance"}
    HOLD -->|Exhausted| BASELINE
    HOLD -->|Admitted| SAVE["Revision-checked reservation checkpoint"]
    SAVE -->|Failed| BASELINE
    SAVE -->|Saved| CALL["TypeSafe retry judgment"]
    CALL -->|Interrupted, no receipt| KEEP["Retain conservative hold"]
    CALL -->|Response| SETTLE["Validate complete usage receipt and settle ledger"]
    SETTLE --> DURABLE["Revision-checked settlement checkpoint"]
    DURABLE -->|Failed| BASELINE
    DURABLE -->|Saved| VERDICT["Validate judgment and apply existing probability bands"]
    VERDICT -->|Invalid or ambiguous| BASELINE
    VERDICT -->|Adopted| RETRY["Existing bounded retry policy"]
    KEEP --> BASELINE
```

A complete receipt can lower a provisional hold; the updated balance is saved
before using the judgment. Missing or malformed usage retains the hold. Restarts
restore the saved spend, and revision conflicts cannot authorize another call.
Recovery validates the saved execution schema before restoring that balance or
writing a resume checkpoint. Firestore timestamps are normalized to milliseconds,
and omitted legacy history defaults to an empty list. Malformed state is refused
and excluded from the recovery list. A recorded action result proceeds directly
to evaluation through the existing checkpoint path.

The provider exposes no per-call token ceiling: actual overages are recorded and
close further admission. This is execution token accounting, not proof of a
provider-side hard monetary ceiling. Other semantic consumers still require
integration with this execution-scoped admission mechanism.
