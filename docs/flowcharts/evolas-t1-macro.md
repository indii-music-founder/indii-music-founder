# Evolas T1 — Macro Architecture

Scope: `docs/EVOLAS_BUILD_PLAN.md` Phase T1 only. This is the style/substance
split with fader-driven prompt compilation, cached at the persona level,
measured against human anchor texts. No fine-tuning, no bandit, no per-user
weight changes anywhere in this diagram.

```mermaid
flowchart TD
    U["User sets or adjusts a fader from 0 to 100 per axis"] --> FS[("Firestore personaFaders/uid/personaId")]

    Q["User question to a persona"] --> SUB["Substance call with frozen non-personalized behavior"]
    SUB -->|"responseSchema JSON"| V["Verdict object with verdict, risk level, caveats, and escalation"]

    FS --> COMP["PersonaPromptCompiler maps faders to calibrated language, never raw numbers"]
    PERSONA["Persona archetype prompt for Manager, Contract Reader, A and R, and others"] --> CACHE[("CachedContent system instruction shared per persona")]

    COMP --> STYLE["Style call renders the verdict in the compiled voice"]
    CACHE --> STYLE
    V --> STYLE
    STYLE --> R["Response to user"]

    R --> IMP["Implicit signals such as copied, acted on, re-asked, or abandoned"]
    R --> RATE["Explicit thumbs or stars rating"]
    IMP --> FB[("AgentFeedbackEvent")]
    RATE --> FB
    FB -->|"style only, never substance"| FS

    R -.-> MEAS["PersonaMeasurement embeds the response and scores it against human anchors"]
    MEAS -->|"set position versus measured position"| TEL[("Telemetry")]

    CANARY["Frozen canary suite for sycophancy, style invariance, disclaimers, and off-domain alignment"] -.->|"gates every prompt-version promotion"| COMP

    style V fill:#1e3a5f,color:#fff
    style FB fill:#5f1e1e,color:#fff
    style CANARY fill:#3f5f1e,color:#fff
```

## Transition Breakdown

- **Substance call and style call are separate API calls.** The style call
  never receives the raw user question — only the already-computed verdict
  object plus the compiled persona voice. It has nothing to delete a caveat
  *from*, because it never had the caveat's source material.
- **Ratings write to Firestore's fader document, not to any model weights.**
  There is no arrow from `FB` to a training/tuning step anywhere in this
  diagram, because Phase T1 (and T2, and T3 per the non-negotiables) has
  no such step.
- **The canary suite sits between the compiler and shipping a new prompt
  version** — it gates promotion, it does not gate individual requests.
- **Cache is keyed by persona, not by user.** The per-user fader block is
  assembled outside the cached prefix so cost stays flat as users scale.

## Out of scope for this diagram

T2 (bandit over fader positions, best-of-3 re-ranking) and T3 (distillation,
aggregate preference tuning, self-hosted Gemma) are separate phases with
their own gates — see `docs/EVOLAS_BUILD_PLAN.md`. Not diagrammed here to
keep this macro view scoped to what's actually being built next.
