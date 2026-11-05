---
description: Current tuned-endpoint routing and the founder-directed Argon migration, with tool and media boundaries.
---

# Chat Model Routing and Migration

Reviewed 2026-11-05. Solid edges below show inspected implementation. Dashed edges show the intended migration and its acceptance work; they are not deployed-state claims.

```mermaid
flowchart TD
    Chat["Direct chat or Boardroom execution"] --> Agent["Agent identity, prompt, tools, and context"]
    Agent --> Registry["Current getFineTunedModel registry"]
    Registry --> Tuned["Generated R8 Vertex endpoints and explicit domain aliases"]
    Tuned --> Backend["Authenticated backend generation and streaming"]
    Backend --> Response["Response or explicit specialist-unavailable error"]
    Agent --> Tools["Tool schemas, policy, approval, and execution evidence"]
    Tools --> Media["Existing image, video, audio, retrieval, and department tools"]
    Agent -.-> Conductor["Target: Conductor uses Argon"]
    Agent -.-> Workers["Target: other agents use approved Flash workhorse"]
    Conductor -.-> Gate["Verify provider IDs, access, capabilities, routing, and cost admission"]
    Workers -.-> Gate
    Gate -.-> Validation["Validate direct chat, Boardroom, tools, and failure recovery"]
    Media -.-> Preserve["Preserve Nano Banana fast and Pro image paths and other supported tools"]
    Preserve -.-> Validation
```

## Transition Breakdown

1. `packages/renderer/src/services/agent/fine-tuned-models.ts` currently requires a tuned endpoint for each valid agent, directly or through an alias. `IndiiNucleus.ts` also selects the generalist tuned model. Updating only a central model label would not migrate these call sites.
2. The founder directs Conductor to Argon and other agents to Flash. The recalled “Flash 3.5” version needs confirmation against the approved current provider catalog before selecting an API ID. Argon is the target, not an assertion that existing tuned endpoints already serve it.
3. Model migration must cover renderer selection, backend provider routing, supported tool schemas, streaming, token and cost reservation, and error attribution. Preserve agent identities, scoped permissions, and evidence-based receipts.
4. Media tools have their own provider/model paths. Keep fast Nano Banana and Pro image generation, plus other supported agent tools, in the acceptance matrix. A text-model migration alone does not validate image generation or asset retrieval.
5. A specialist-unavailable response is a surfaced failure, not proof of its root cause. The backend classifier groups multiple provider errors; diagnose the original provider status and routing configuration before naming an outage.
6. Keep approvals deterministic and request-bound. See [approval lifecycle](08-bug-reporter-pipeline.md) and [Boardroom execution](04-boardroom-context-orchestration.md). Provider success, tool authorization, tool completion, and visible deliverable rendering are separate acceptance checks.

## Completion criteria

Confirm exact provider model IDs and account access; replace or explicitly retire old tuned routing; verify genuine authenticated direct and Boardroom requests; exercise request-bound approve/deny and recovery; verify fast and Pro images and retained tools; inspect exact-commit CI and deployed behavior before calling the migration complete.
