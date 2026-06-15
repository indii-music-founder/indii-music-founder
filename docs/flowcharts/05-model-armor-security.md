---
description: Architectural map of the Model Armor security pipeline, demonstrating the evaluation scope adjustments that prevent historical false positives while maintaining robust pattern blocking.
---

# Model Armor Security Pipeline

This flowchart outlines the Model Armor execution path. It visualizes how the system intercepts and sanitizes user prompts *before* they reach the generative AI models. Crucially, it highlights the architectural fix that isolates the evaluation to the immediate prompt payload rather than concatenating the entire conversation history, thereby eliminating false-positive trigger loops on routine agent delegations.

```mermaid
graph TD
    %% ╔══════════════════════════════════════════╗
    %% ║        INPUT INTERCEPTION                ║
    %% ╚══════════════════════════════════════════╝
    subgraph INPUT ["📥 Input Layer"]
        USER_REQ["User Prompt /<br/>Agent Delegation Payload"]
        HISTORY["Conversation History<br/>(Prior context)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        MODEL ARMOR LAYER                 ║
    %% ╚══════════════════════════════════════════╝
    subgraph ARMOR ["🛡️ ModelArmor (Security Middleware)"]
        direction TB
        EXTRACT["Extract Immediate Payload<br/>(task string ONLY)"]
        REGEX_SCAN["Regex Pattern Scanner<br/>(Jailbreaks, Prompts)"]
        SYS_SCAN["System Boundary Scanner<br/>(Ignore instructions)"]
        
        EXTRACT --> REGEX_SCAN
        REGEX_SCAN --> SYS_SCAN
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        OUTCOME GATES                     ║
    %% ╚══════════════════════════════════════════╝
    subgraph GATES ["🚦 Execution Gates"]
        CLEAN["✅ Clean (Pass)"]
        BLOCKED["🛑 Blocked (Fail)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        EXECUTION & LOGGING               ║
    %% ╚══════════════════════════════════════════╝
    subgraph EXECUTION ["🚀 Core Execution"]
        LLM["Gemini 3 Pro Inference"]
        ERROR_UI["UI Error State<br/>(Model Armor Blocked)"]
        LOGGER["Security Audit Log"]
    end

    %% Connections
    USER_REQ --> EXTRACT
    HISTORY -.->|Explicitly EXCLUDED<br/>from scan scope| EXTRACT
    
    SYS_SCAN -->|Violation Found| BLOCKED
    SYS_SCAN -->|No Violations| CLEAN
    
    CLEAN --> LLM
    BLOCKED --> ERROR_UI
    BLOCKED --> LOGGER

    classDef input fill:#00D4FF,stroke:#0077AA,stroke-width:2px,color:#001018
    classDef armor fill:#39FF14,stroke:#1A8800,stroke-width:2px,color:#001018
    classDef gate fill:#F59E0B,stroke:#B45309,stroke-width:2px,color:#001018
    classDef exec fill:#E11D48,stroke:#9F1239,stroke-width:2px,color:#FFFFFF

    class USER_REQ,HISTORY input
    class EXTRACT,REGEX_SCAN,SYS_SCAN armor
    class CLEAN,BLOCKED gate
    class LLM,ERROR_UI,LOGGER exec
```

## Transition Breakdown

1. **Input Interception**: Every prompt submitted by the user or generated internally via an agent delegation payload is intercepted by the `ModelArmor` middleware before any API call is made.
2. **Scope Extraction (The Fix)**: `ModelArmor` explicitly extracts *only* the immediate `task` string payload. It completely isolates and excludes the `Conversation History` from the scan. *This prevents false positives where benign prompts were blocked because previous agent responses or system identity locks contained patterns matching "ignore previous instructions" or "jailbreak".*
3. **Regex & System Boundary Scans**: The isolated task string is run through a strict battery of RegEx pattern matchers. This checks for known jailbreak vectors, system boundary circumvention attempts, and prompt injection techniques.
4. **Execution Gate Evaluation**: 
    - **Clean Path**: If the scan yields no violations, the prompt passes the gate, attaches its unmodified conversation history, and proceeds securely to the Gemini 3 Pro inference engine.
    - **Blocked Path**: If a violation is found, execution immediately halts. The system throws a specific error to the UI indicating `[Blocked by Model Armor]` along with the flagged regex pattern, and logs the attempt for security auditing.
