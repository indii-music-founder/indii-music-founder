# Admin Dashboard Truthful State Flow

This diagram documents how the DDEX, Nexus, and Google Workspace operator panels derive their visible state from authenticated backend evidence. Empty, disconnected, unavailable, and verified are separate outcomes; transport, authorization, and schema failures never become optimistic status or empty data.

```mermaid
flowchart TD
    Operator["Authenticated indii.music operator"] --> AdminUI["Admin dashboard"]
    AdminUI --> Token["Firebase admin ID token"]

    AdminUI --> DDEX["DDEXTracker"]
    DDEX --> DeliveryAPI["GET /api/deliveries/list"]
    Token --> DeliveryAPI
    DeliveryAPI --> DeliveryStore["Firestore deliveries collection"]
    DeliveryStore --> DeliveryParse{"Response and rows valid?"}
    DeliveryParse -->|"No"| DeliveryError["Deliveries unavailable"]
    DeliveryParse -->|"Yes"| DeliveryStats["Delivered, terminal failure rate, destinations, and in-flight formats"]
    DeliveryStats --> DeliveryEmpty{"Any real delivery rows?"}
    DeliveryEmpty -->|"No"| HonestQueueEmpty["Queue is genuinely empty"]
    DeliveryEmpty -->|"Yes"| DeliveryTable["Render fetched deliveries"]

    AdminUI --> Nexus["NexusMonitor"]
    Nexus --> NexusReads["Concurrent DNS and event-log requests"]
    Token --> NexusReads
    NexusReads --> DNSAPI["GET /api/dns/status"]
    NexusReads --> LogAPI["GET /api/nexus/logs"]
    DNSAPI --> DNSResolver["Live SPF, DKIM, and DMARC resolution"]
    LogAPI --> EventStore["Firestore system_events collection"]
    DNSResolver --> NexusGate{"Both responses valid?"}
    EventStore --> NexusGate
    NexusGate -->|"No"| NexusError["Status unavailable"]
    NexusGate -->|"Yes, all records verified"| NexusGreen["All records verified"]
    NexusGate -->|"Yes, any record unverified"| NexusAmber["Records unverified"]

    AdminUI --> Workspace["GoogleHub"]
    Workspace --> StatusAPI["GET /api/google/status"]
    Token --> StatusAPI
    StatusAPI --> OAuthStore["Stored Google OAuth credentials"]
    OAuthStore --> LinkGate{"Link status proven?"}
    LinkGate -->|"Status request failed"| LinkUnknown["Workspace link status unavailable"]
    LinkGate -->|"Authorized false"| LinkPrompt["Workspace not linked"]
    LinkGate -->|"Authorized true"| ServiceTabs["Gmail, Calendar, and Drive tabs"]
    ServiceTabs --> GoogleReads["Authenticated Workspace API reads"]
    GoogleReads --> GoogleGate{"HTTP result and payload valid?"}
    GoogleGate -->|"412"| LinkPrompt
    GoogleGate -->|"Other failure or malformed payload"| DataError["Workspace data unavailable"]
    GoogleGate -->|"Valid empty collection"| HonestWorkspaceEmpty["Service is genuinely empty"]
    GoogleGate -->|"Valid records"| WorkspaceData["Render fetched records"]

    classDef ui fill:#e0f7fa,stroke:#00acc1,stroke-width:2px,color:#06202a
    classDef service fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#24102d
    classDef data fill:#fff3e0,stroke:#ff8f00,stroke-width:2px,color:#301d00
    classDef verified fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#0b2c0d
    classDef gate fill:#fce4ec,stroke:#d81b60,stroke-width:2px,color:#3b071a

    class Operator,AdminUI,DDEX,Nexus,Workspace,ServiceTabs ui
    class Token,DeliveryAPI,NexusReads,DNSAPI,LogAPI,StatusAPI,GoogleReads service
    class DeliveryStore,DNSResolver,EventStore,OAuthStore data
    class DeliveryStats,HonestQueueEmpty,DeliveryTable,NexusGreen,NexusAmber,LinkPrompt,HonestWorkspaceEmpty,WorkspaceData verified
    class DeliveryParse,DeliveryEmpty,NexusGate,LinkGate,GoogleGate,DeliveryError,NexusError,LinkUnknown,DataError gate
```

## Transition breakdown

1. Each panel sends the operator's Firebase ID token to an admin endpoint protected by the server's `requireAdminAuth` boundary. A `401` or `403` becomes an actionable authentication error instead of an empty dataset.
2. `DDEXTracker` accepts only valid delivery rows, using the Firestore document ID when a duplicated `releaseId` field is absent. Its delivery count, terminal failure rate, distinct destinations, and in-flight ERN formats are derived from the returned queue in one pass.
3. A successful empty delivery response renders the queue-empty message. A failed or malformed response clears stale rows and renders unavailable, so an outage cannot impersonate a quiet queue.
4. `NexusMonitor` starts the independent DNS and log reads concurrently with `Promise.allSettled`. A rejected request, non-success status, or invalid body clears stale state and produces the red unavailable state.
5. Nexus is green only when SPF, DKIM, and DMARC each explicitly read `verified`. Any successful but unverified result is amber; loading and backend failure have distinct states.
6. `GoogleHub` first proves whether a Workspace credential is present. A failed status request leaves the link state unknown, while an explicit `authorized: false` result alone renders the connection prompt.
7. Once linked, Gmail, Calendar, and Drive responses are structurally parsed. A `412` means authorization disappeared and returns to the connection prompt; other failures or malformed payloads render data unavailable. Only a successful, valid empty array may render an empty inbox, calendar, or Drive.
8. OAuth initiation accepts only an HTTPS redirect URL. Write operations also interpret `412` as a lost link and never preserve a false connected state after credential loss.
