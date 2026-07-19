---
description: Interaction flowchart detailing how Omni Mode routing dictates agent delegation boundaries, context scoping, and error communication across Direct, Department, and Boardroom modes.
---

# Omni Mode Routing & Delegation Boundaries

This flowchart visualizes the strict boundaries enforced by the AgentModePicker (Omni Mode). It demonstrates how switching between Direct Mode, Department Mode, and Boardroom Mode fundamentally alters the `delegationScopeSection` injected into the LLM system prompt, effectively blocking cross-department hallucinations and ensuring precise error communication.

```mermaid
graph TD
    %% ╔══════════════════════════════════════════╗
    %% ║        OMNI MODE SELECTION               ║
    %% ╚══════════════════════════════════════════╝
    subgraph OMNI_UI ["🎛️ AgentModePicker (UI)"]
        DIRECT_MODE["Direct Mode<br/>(1:1 Solo)"]
        DEPT_MODE["Department Mode<br/>(Scoped Team)"]
        BOARDROOM_MODE["Boardroom Mode<br/>(Full Swarm)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        PROMPT INJECTION BOUNDARIES       ║
    %% ╚══════════════════════════════════════════╝
    subgraph INJECTION ["💉 AgentPromptBuilder (System Prompt)"]
        DIRECT_SCOPE["Inject: STRICT ISOLATION<br/>(Cross-delegation explicitly banned)"]
        DEPT_SCOPE["Inject: DEPARTMENT SCOPE<br/>(Only peer agents in same dept allowed)"]
        BOARDROOM_SCOPE["Inject: UNLIMITED SCOPE<br/>(Full A2A swarm delegation enabled)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        USER REQUEST                      ║
    %% ╚══════════════════════════════════════════╝
    REQ["User asks Finance Agent:<br/>'Consult Legal'"]

    %% ╔══════════════════════════════════════════╗
    %% ║        LLM INFERENCE & OUTCOME           ║
    %% ╚══════════════════════════════════════════╝
    subgraph INFERENCE ["🧠 BaseAgent Inference & NLP Feedback"]
        DIRECT_EVAL{"Direct Mode<br/>Evaluation"}
        DEPT_EVAL{"Dept Mode<br/>Evaluation"}
        BOARDROOM_EVAL{"Boardroom Mode<br/>Evaluation"}

        REJECT_DIRECT["❌ Explicit NLP Rejection<br/>'I am in Direct Mode. I cannot delegate.'"]
        REJECT_DEPT["❌ Explicit NLP Rejection<br/>'Legal is out of my department scope.'"]
        EXECUTE["✅ Delegation Accepted<br/>Executes consult_specialist tool"]
    end

    %% Connections
    DIRECT_MODE --> DIRECT_SCOPE
    DEPT_MODE --> DEPT_SCOPE
    BOARDROOM_MODE --> BOARDROOM_SCOPE

    REQ --> DIRECT_EVAL
    REQ --> DEPT_EVAL
    REQ --> BOARDROOM_EVAL

    DIRECT_SCOPE -.-> DIRECT_EVAL
    DEPT_SCOPE -.-> DEPT_EVAL
    BOARDROOM_SCOPE -.-> BOARDROOM_EVAL

    DIRECT_EVAL --> REJECT_DIRECT
    DEPT_EVAL -->|Finance != Legal| REJECT_DEPT
    BOARDROOM_EVAL --> EXECUTE

    classDef ui fill:#00D4FF,stroke:#0077AA,stroke-width:2px,color:#001018
    classDef inject fill:#39FF14,stroke:#1A8800,stroke-width:2px,color:#001018
    classDef req fill:#F59E0B,stroke:#B45309,stroke-width:2px,color:#001018
    classDef eval fill:#8B5CF6,stroke:#6D28D9,stroke-width:2px,color:#FFFFFF
    classDef outcome fill:#E11D48,stroke:#9F1239,stroke-width:2px,color:#FFFFFF
    classDef pass fill:#10B981,stroke:#047857,stroke-width:2px,color:#FFFFFF

    class DIRECT_MODE,DEPT_MODE,BOARDROOM_MODE ui
    class DIRECT_SCOPE,DEPT_SCOPE,BOARDROOM_SCOPE inject
    class REQ req
    class DIRECT_EVAL,DEPT_EVAL,BOARDROOM_EVAL eval
    class REJECT_DIRECT,REJECT_DEPT outcome
    class EXECUTE pass
```

## Transition Breakdown

1. **Mode Selection**: The user interacts with the `AgentModePicker` to select the conversational context: Direct, Department, or Boardroom.
2. **Boundary Injection**: When the `BaseAgent` compiles its system prompt via `AgentPromptBuilder`, it dynamically injects a strict `delegationScopeSection` based on the selected mode. 
    - *Direct Mode* explicitly forbids the LLM from attempting cross-delegation, eliminating hallucinations where the agent says "I'll do that" but takes no action.
    - *Department Mode* provides a whitelist of peer agents within the same functional silo.
    - *Boardroom Mode* removes the restrictions, injecting the full `[SEATED_AGENTS]` manifest for universal swarm execution.
3. **Out-of-Scope Execution Evaluation**: When a user makes an invalid request (e.g., asking a Finance agent to consult Legal while in Direct Mode), the LLM reads its strict injected boundaries.
4. **NLP Rejection & Feedback**: Instead of silently failing or hallucinating a capability it doesn't possess, the agent explicitly rejects the request in its Natural Language Processing (NLP) response, clearly communicating the mode constraint to the user (e.g., "I am currently in Direct Mode and cannot consult the Legal department. Please switch to Boardroom mode").
5. **Valid Execution**: If the mode permits the action (Boardroom), the agent executes the `consult_specialist` tool and the standard Swarm Delegation loop commences.
