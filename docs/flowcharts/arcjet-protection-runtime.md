# Arcjet protection runtime

Arcjet is a server-only abuse-control layer. It never grants access, chooses a
subscription tier, stores a secret in a browser, or replaces App Check,
ownership, idempotency, provider quotas, and server-side cost admission.

```mermaid
flowchart TD
    User["User or automation"] --> Edge["Specific HTTP or callable handler"]
    Edge --> Identity["Firebase Auth + App Check + verified email"]
    Identity --> Entitlement["Server-owned entitlement and cost admission"]
    Entitlement --> Policy["Server-derived Arcjet policy class"]
    Policy --> Request["Arcjet request protection"]
    Request --> Operation["Protected backend operation"]

    Mcp["MCP tool call"] --> Guard["Arcjet Guard: fixed tool label"]
    Queue["Cloud Task or worker"] --> Guard
    Guard --> Operation

    Operation --> Vertex["Vertex AI or protected provider"]
    Operation --> Ledger["Server-owned operation and audit ledger"]
    Request --> Decision["Redacted decision and retry metadata"]
    Guard --> Decision

    classDef edge fill:#17213c,stroke:#60a5fa,color:#fff
    classDef gate fill:#2a1642,stroke:#c084fc,color:#fff
    classDef protected fill:#12362c,stroke:#4ade80,color:#fff
    classDef audit fill:#3d2d09,stroke:#facc15,color:#fff
    class Edge edge
    class Identity,Entitlement,Policy,Request,Guard gate
    class Operation,Vertex,Ledger protected
    class Decision audit
```

## Transition Breakdown

1. The caller reaches a specific backend handler; no browser code imports
   Arcjet or provider credentials.
2. Firebase Auth, App Check, verified-email policy, and server-owned
   entitlements establish identity and admission before Arcjet evaluates
   abuse risk.
3. The backend derives a fixed Arcjet policy class. Client input cannot select
   a more permissive tier or bypass provider and cost controls.
4. Arcjet either returns a structured denial/retry decision or permits the
   protected operation to continue.
5. The protected operation invokes Vertex AI or another backend-only provider
   and records a redacted server-owned operation receipt.
6. MCP tools and background workers enter through a fixed-label Arcjet Guard;
   they do not reuse browser request state or trust model-supplied identity.

## Runtime invariants

1. Firebase Functions mounts `ARCJET_KEY` only through the `secrets` option on
   the handlers that call request protection. The secret is never a client
   variable, Firestore value, source literal, or log field.
2. An authenticated route derives its Arcjet class from a backend-verified
   entitlement and trusted Firebase custom admin claim. The client cannot
   select Free, paid, Founder, admin, or BYO-API treatment.
3. Founder access stays product-unlimited, but retains a distinct automation
   ceiling. Arcjet does not override provider quotas or cost admission.
4. Missing configuration and decision errors fail closed with a structured
   `503`. Rate limits return `429` with `Retry-After`; policy denials return
   `403`. Logs correlate only Arcjet decision IDs with generated operation
   IDs, never prompts, raw headers, secrets, or master-asset locations.
5. The unauthenticated `/health` liveness read is the sole request-protection
   degradation exception: it may return normally while Arcjet is unavailable,
   and emits a redacted warning. It performs no data access or state mutation.
6. MCP tools, queue workers, and other non-HTTP operations require
   `@arcjet/guard` with a fixed per-operation label after the deployed Node
   runtime is proven compatible; HTTP request protection is not a substitute.
