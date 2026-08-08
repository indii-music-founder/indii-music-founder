# Durable Pre-Save Campaign Flow

This diagram documents the production pre-save path from artist publication through consented fan-lead persistence and DSP handoff. It also identifies the gates that prevent a share link or redirect from appearing before the underlying data is durable.

```mermaid
flowchart TD
    Artist["Artist enters campaign and official DSP links"] --> Builder["PreSaveCampaignBuilder"]
    Builder --> Publish["Publish Campaign"]
    Publish --> ClientCreate["PreSaveCampaignService.createCampaign"]
    ClientCreate --> CreateCallable["createPreSaveCampaign callable"]
    CreateCallable --> CreateGate{"Authenticated, App Check, and schema valid?"}
    CreateGate -->|"No"| PublishError["Show publish error; Copy, Share, and QR stay locked"]
    CreateGate -->|"Yes"| CampaignDoc["presaveCampaigns campaign document"]
    CampaignDoc --> PublishedId["Return persisted campaign ID"]
    PublishedId --> ShareTools["app.indii.music URL, real QR payload, Copy, and Share"]

    Fan["Fan opens published URL on any viewport"] --> RouteGate["App public-route and mobile-bypass checks"]
    RouteGate --> Landing["PreSaveLandingPage"]
    Landing --> ClientRead["PreSaveCampaignService.getCampaign"]
    ClientRead --> ReadCallable["getPreSaveCampaign callable"]
    ReadCallable --> ReadGate{"App Check and Arcjet read protection pass?"}
    ReadGate -->|"No"| Unavailable["Render unavailable state"]
    ReadGate -->|"Yes"| PublicProjection["Return public campaign projection without owner or lead data"]
    PublicProjection --> Consent["Fan enters requested contact data and consent"]
    Consent --> DspAction["Fan selects a configured DSP"]
    DspAction --> ClientLead["PreSaveCampaignService.recordLead"]
    ClientLead --> RegisterCallable["presaveRegister callable"]
    RegisterCallable --> WriteGate{"App Check, Arcjet, campaign, DSP, and consent valid?"}
    WriteGate -->|"No"| LeadError["Show retryable error; do not redirect"]
    WriteGate -->|"Yes"| Transaction["Firestore transaction overwrites deterministic lead ID"]
    Transaction --> LeadDoc["presaveCampaigns campaign leads leadId"]
    Transaction --> LeadCount["Increment leadCount only for a new lead ID"]
    LeadDoc --> Outbox["Await deterministic conversionEventOutbox record"]
    Outbox --> DurableGate{"Lead and conversion durability confirmed?"}
    DurableGate -->|"No"| LeadError
    DurableGate -->|"Yes"| Redirect["Redirect fan to the selected official DSP URL"]

    Owner["Authenticated campaign owner"] --> OwnerRead["Owner-only Firestore reads for campaign and leads"]
    OwnerRead --> CampaignDoc
    Rules["Firestore Rules deny all client campaign and lead writes"] --> CampaignDoc
    Rules --> LeadDoc

    classDef ui fill:#dff7ff,stroke:#00a6c8,stroke-width:2px,color:#062a30
    classDef logic fill:#eee5ff,stroke:#7c3aed,stroke-width:2px,color:#24113f
    classDef data fill:#fff1d6,stroke:#e27b00,stroke-width:2px,color:#442500
    classDef cloud fill:#e4ffe0,stroke:#20a84b,stroke-width:2px,color:#12351c
    classDef error fill:#ffe4f3,stroke:#db1685,stroke-width:2px,color:#48102f

    class Artist,Fan,Builder,Landing,Consent,DspAction,ShareTools,Owner ui
    class Publish,ClientCreate,ClientRead,ClientLead,RouteGate,CreateGate,ReadGate,WriteGate,DurableGate logic
    class CampaignDoc,LeadDoc,LeadCount,Outbox,OwnerRead,Rules data
    class CreateCallable,ReadCallable,RegisterCallable,PublicProjection,PublishedId,Transaction,Redirect cloud
    class PublishError,Unavailable,LeadError error
```

## Transition breakdown

1. The artist supplies a title, release date, optional cover art, collection preferences, and at least one official HTTPS DSP URL. The builder does not derive a public campaign identifier locally.
2. `PreSaveCampaignService.createCampaign` invokes `createPreSaveCampaign`. The callable requires an authenticated user and App Check, validates the full campaign shape and official DSP domains, and writes the campaign with the Admin SDK.
3. Only the Firestore-generated campaign ID unlocks the canonical `https://app.indii.music/presave/{campaignId}` URL, its QR encoding, and Copy/Share actions. Failed or dirty publications stay unshareable.
4. `App.tsx` recognizes the pre-save route before authentication, and the mobile routing policy exempts it from the Controller surface. A phone therefore reaches the same public landing page as a desktop browser.
5. The landing page loads a callable-produced public projection. Owner identity, lead count, timestamps, and fan data never enter the public response.
6. When contact capture is configured, the fan must provide the requested fields and explicit marketing consent before a DSP action can proceed.
7. `presaveRegister` applies App Check and fail-closed Arcjet protection, validates the live campaign and selected configured DSP, then writes `leads/{leadId}` transactionally. Repeating the same lead ID overwrites that document and does not increment `leadCount` again.
8. The callable awaits a conversion-outbox write whose event ID is deterministically derived from the lead ID. Only confirmed lead and conversion durability returns success; otherwise the page remains in place with a retryable error.
9. Firestore Rules let the authenticated campaign owner read their own campaign and leads, while every client-side create, update, or delete is denied. All trusted writes therefore pass through the validated callables.
