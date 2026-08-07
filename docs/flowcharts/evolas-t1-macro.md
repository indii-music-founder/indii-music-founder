# Evolas T1 — Macro Architecture

Scope: `docs/EVOLAS_BUILD_PLAN.md` Phase T1 only. This is the style/substance
split with fader-driven prompt compilation, cached at the persona level,
measured against human anchor texts. No fine-tuning, no bandit, no per-user
weight changes anywhere in this diagram.

```mermaid
flowchart TD
    U[User sets/adjusts fader<br/>0-100 per axis] --> FS[(Firestore<br/>personaFaders/uid/personaId)]

    Q[User question to a persona] --> SUB[Substance call<br/>non-personalized, frozen]
    SUB -->|responseSchema JSON| V["Verdict object<br/>{verdict, risk_level, caveats[], escalate}"]

    FS --> COMP[PersonaPromptCompiler<br/>faders -> calibrated language<br/>never raw numbers]
    PERSONA[Persona archetype prompt<br/>Manager / Contract Reader / A&R / etc.] --> CACHE[(CachedContent<br/>systemInstruction, per persona<br/>shared across all users)]

    COMP --> STYLE[Style call<br/>renders V in compiled voice]
    CACHE --> STYLE
    V --> STYLE
    STYLE --> R[Response to user]

    R --> IMP[Implicit signals<br/>copied? acted-on? re-asked? abandoned?]
    R --> RATE[Explicit rating<br/>thumbs/stars]
    IMP --> FB[(AgentFeedbackEvent)]
    RATE --> FB
    FB -->|style only, never substance| FS

    R -.-> MEAS[PersonaMeasurement<br/>embed response, score vs<br/>human anchor texts per band]
    MEAS -->|setPosition vs measuredPosition| TEL[(Telemetry)]

    CANARY[Frozen canary suite<br/>sycophancy probes, style-invariance,<br/>disclaimer retention, off-domain alignment] -.->|gates every prompt-version promotion| COMP

    style V fill:#1e3a5f,color:#fff
    style FB fill:#5f1e1e,color:#fff
    style CANARY fill:#3f5f1e,color:#fff
```

## What this enforces structurally

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
