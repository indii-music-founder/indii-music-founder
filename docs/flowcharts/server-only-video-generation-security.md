# Server-Only Video Generation Security Flow

This map documents the authoritative short-form and long-form video paths. It
separates browser intent from server-owned identity, entitlement, cost,
provider execution, and private artifact delivery.

```mermaid
graph TD
    User["Verified artist requests a video"] --> Renderer["Renderer submits bounded creative intent"]
    Renderer --> Callable["Firebase callable admission"]
    Callable --> Identity["Firebase Auth and signed email verification"]
    Identity --> AppCheck["App Check or authenticated desktop admission"]
    AppCheck --> Arcjet["Arcjet abuse and rate policy"]
    Arcjet --> Entitlement["Server-owned free or founder entitlement"]
    Entitlement --> Normalize["Normalize Veo model, duration, resolution, and audio policy"]
    Normalize --> Reserve["Reserve server-estimated operation cost"]
    Reserve --> Job["Admin SDK creates owner-bound videoJobs record"]
    Job --> ShortWorker["Short-form Firestore worker"]
    Job --> LongWorker["Long-form signed Inngest worker"]
    ShortWorker --> Vertex["Vertex AI via ADC"]
    LongWorker --> Vertex
    Vertex --> PrivateStorage["Owner-scoped private Cloud Storage artifact"]
    PrivateStorage --> Receipt["Durable job, provider, and cost receipt"]
    Receipt --> OwnerRead["Owner-authorized read or signed access"]

    BrowserWrite["Direct browser videoJobs write"] --> Deny["Firestore Rules deny create, update, and delete"]
    RemoteSeed["HTTP or cross-owner seed reference"] --> Deny
    UnsupportedModel["Arbitrary model or unsupported duration"] --> Deny
    LegacyEvent["Legacy video/generate.requested event"] --> Retired["Not registered in deployed Inngest function list"]

    classDef client fill:#082F49,stroke:#00D4FF,stroke-width:2px,color:#F8FAFC;
    classDef gate fill:#3B0764,stroke:#D946EF,stroke-width:2px,color:#F8FAFC;
    classDef cloud fill:#052E16,stroke:#39FF14,stroke-width:2px,color:#F8FAFC;
    classDef data fill:#431407,stroke:#FB923C,stroke-width:2px,color:#F8FAFC;
    classDef deny fill:#4C0519,stroke:#FF00FF,stroke-width:2px,color:#F8FAFC;

    class User,Renderer client;
    class Callable,Identity,AppCheck,Arcjet,Entitlement,Normalize,Reserve gate;
    class Job,PrivateStorage,Receipt,OwnerRead data;
    class ShortWorker,LongWorker,Vertex cloud;
    class BrowserWrite,RemoteSeed,UnsupportedModel,Deny,LegacyEvent,Retired deny;
```

## Transition Breakdown

1. The renderer sends creative intent only. Browser-supplied user IDs and job
   IDs are not authoritative.
2. The callable derives the artist identity from Firebase Auth, requires the
   verified-account admission contract, applies App Check or the authenticated
   desktop contract, and evaluates Arcjet policy.
3. The backend resolves the server-owned entitlement and normalizes the
   requested model and duration before calculating cost. The same normalized
   values are persisted for the worker, preventing billing/provider drift.
4. A server-created reservation precedes the Admin SDK `videoJobs` write.
   Firestore Rules deny direct client mutation of worker-triggering documents.
5. Short-form jobs execute through the Firestore worker; long-form jobs execute
   through the signed Inngest path. Both use Vertex AI with Application Default
   Credentials and no browser provider key.
6. Provider submission evidence is persisted before a billable call. Failures
   settle or void the reservation based on whether provider work may have
   started.
7. Generated videos remain private, owner-scoped Cloud Storage objects. The job
   stores a `gs://` artifact reference; an authorized service must mediate
   customer access.
8. Arbitrary remote seed URLs, cross-owner Storage references, unsupported
   models, unsupported durations, and direct browser job writes fail closed.
   The obsolete single-video Inngest event is not registered for execution.
