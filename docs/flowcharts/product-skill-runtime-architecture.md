# Product Skill Runtime Architecture

Evidence-based visualization of how an embedded Product Skill executes inside the shipped indii.music desktop and web studio.

## Purpose

This architecture diagram traces the end-to-end lifecycle of a Product Skill: from an artist's natural language request or studio action, through intent matching, embedded progressive disclosure, prompt assembly, deterministic tool invocation, governance gates, and final state reconciliation.

```mermaid
graph TD
    classDef trigger fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#fff;
    classDef router fill:#312e81,stroke:#818cf8,stroke-width:2px,color:#fff;
    classDef playbook fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#fff;
    classDef engine fill:#701a75,stroke:#d946ef,stroke-width:2px,color:#fff;
    classDef tools fill:#1e293b,stroke:#64748b,stroke-width:2px,color:#fff;
    classDef gate fill:#7f1d1d,stroke:#ef4444,stroke-width:2px,color:#fff;
    classDef terminal fill:#065f46,stroke:#34d399,stroke-width:2px,color:#fff;

    USER["Artist or Studio User"]:::trigger --> UI["Studio Command Bar and UI Surface"]:::trigger
    UI --> CONDUCTOR["Conductor Orchestrator (AgentService)"]:::router
    
    subgraph Discovery["Discovery and Progressive Activation"]
        CONDUCTOR --> REGISTRY["Embedded ProductSkillRegistry"]:::playbook
        REGISTRY --> PIPELINE["ContextPipeline Prompt Assembler"]:::router
        PIPELINE --> MODEL["Gemini 3 Pro Intelligence Engine"]:::engine
    end

    subgraph Execution["Deterministic Execution and Governance"]
        MODEL --> TOOLS["Deterministic Tool Suite (TypeScript Tools)"]:::tools
        TOOLS --> GATES{"ApprovalGateRegistry Gate Check"}:::gate
        GATES -->|"High Risk or Irreversible"| CONFIRM["Artist Approval Modal (User Gate)"]:::gate
        CONFIRM -->|"Artist Rejects"| BLOCKED["Action Terminated and Logged"]:::gate
        CONFIRM -->|"Artist Approves"| EXECUTE["Execute Local or Cloud Sidecar"]:::terminal
        GATES -->|"Read-Only or Safe Draft"| EXECUTE
    end

    EXECUTE --> RESULT["Living Plan and Project State Updated"]:::terminal
    RESULT --> UI
```

## Step-by-Step Transition Breakdown

### Phase 1: Artist Request & Intent Dispatch
1. **User Action:** The artist types a request into the studio Command Bar or triggers a studio workflow button (e.g., "Prepare master for Spotify release").
2. **Surface Intake:** The Studio UI captures the input, sanitizes attachments, and hands the message to `AgentService.ts`.
3. **Orchestrator Routing:** The Conductor classifies the user's intent across 23 specialist domains (e.g., Music Director, Distribution Chief, Publishing Administrator).

### Phase 2: Embedded Discovery & Progressive Disclosure
4. **Registry Lookup:** The Conductor consults `ProductSkillRegistry`, an in-memory compile-time registry embedded directly inside the app bundle. It identifies the target skill (e.g., `audio_engineering` or `digital_distribution`).
5. **Context Splicing:** Rather than stuffing all 27 playbooks into the prompt, `ContextPipeline.ts` retrieves only the active `SKILL.md` playbook and injects it into the prompt's `<active_product_skill>` section.
6. **Reasoning & Protocol Adherence:** Gemini 3 Pro receives the exact industry standard operating procedure (e.g., -14 LUFS loudness ceiling, -1.0 dB True Peak, 3000x3000px RGB cover art).

### Phase 3: Deterministic Execution & Safety Gates
7. **Tool Invocation:** The model emits a structured tool call into `TOOL_REGISTRY` (e.g., `scan_master`, `compile_release_harness`, or `register_work`).
8. **Risk Tier Evaluation:** `ApprovalGateRegistry.ts` evaluates the action's risk level (`read`, `draft`, `approval_required`, or `destructive`).
9. **Artist Approval Gate:**
   - **Safe/Read Actions:** (e.g., audio frequency analysis, metadata QC) execute immediately.
   - **Irreversible Actions:** (e.g., paying out royalties, submitting DDEX packages, signing split contracts, spending ad budgets) halt execution and prompt the artist for explicit confirmation via `ConfirmDialog.call()`.
10. **Sidecar/Engine Execution:** Upon approval, the deterministic TypeScript/Python execution layer completes the task (e.g., ffprobe analysis, DDEX XML compilation, Stripe/Printful checkout).

### Phase 4: Truthful State Reconciliation
11. **Persistence & Plan Update:** The outcome is written to the project's Living Plan, Firestore state, or local vault.
12. **Artist Feedback:** The UI renders the verified result with exact metrics, confidence scores, and run IDs—with zero simulated or hallucinated numbers.
