# Truthful Commerce, Distribution, and Security Remediation

This map defines the runtime truth boundaries for limited drops, release lookup, DDEX readiness, production dependencies, and organization access control. A customer-facing success or readiness state is emitted only after its corresponding persisted or verified evidence exists.

```mermaid
flowchart TD
    User["Artist or organization owner"] --> DropUI["DropCampaignWizard.tsx"]
    Agent["Agent tool call"] --> CommerceTool["CommerceTools.ts"]
    DropUI --> DropService["LimitedDropService.createDraft"]
    CommerceTool --> DropService
    DropService --> DropValidate{"Valid future drop draft?"}
    DropValidate -->|"No"| DropError["Visible validation or persistence error"]
    DropValidate -->|"Yes"| DropStore["Firestore limitedDrops top-level collection"]
    DropStore --> DropResult["Draft ID plus notification setup_required"]
    DropResult --> HonestDrop["UI says draft saved, never live or notified"]

    Agent --> ReleaseTools["PublishingTools, Web3Tools, CoreTools"]
    ReleaseTools --> ReleaseCatalog["ReleaseCatalogService"]
    ReleaseCatalog --> ReleaseStore["Firestore proprietaryIngestionReleases top-level collection"]
    ReleaseStore --> ReleaseMatch{"Owned release match?"}
    ReleaseMatch -->|"Yes"| ReleaseEvidence["Return matching local release evidence"]
    ReleaseMatch -->|"No"| NoMatch["Return explicit no-match result"]
    ReleaseCatalog -->|"Permission or query failure"| QueryError["Return explicit lookup unavailable error"]

    Intake["Release metadata and selected stores"] --> Readiness["buildDistributionReadiness"]
    Authority["Verified sender DPID, recipient credentials, onboarding, feed profile, validation receipt"] --> Readiness
    Readiness --> AuthorityGate{"All delivery authority evidence verified?"}
    AuthorityGate -->|"No"| MetadataOnly["metadata_only with named blockers"]
    AuthorityGate -->|"Yes"| PackageReady["package_ready"]
    PackageReady --> Compiler["DistributionDdexCompiler"]
    MetadataOnly --> Compiler
    Compiler --> Score["Evidence-based readiness score and findings"]

    Manifests["Workspace package manifests and lockfile"] --> Install["Deterministic npm install and npm ci"]
    Install --> Audit["npm audit --omit=dev"]
    Install --> DependencyTree["npm ls reachability check"]
    Audit --> DependencyGate{"No reachable critical or high findings?"}
    DependencyTree --> DependencyGate
    DependencyGate -->|"No"| DependencyFix["Upgrade, override, or remove runtime dependency"]
    DependencyFix --> Install
    DependencyGate -->|"Yes"| RuntimeAccepted["Production dependency graph accepted"]

    Owner["Organization owner in Security Center"] --> AccessPane["AccessControlPane"]
    AccessPane --> AccessService["OrganizationAccessService"]
    AccessService --> AccessFunctions["Authenticated organization access callables"]
    AccessFunctions --> RequestGate{"App Check, server entitlement, and Arcjet allow?"}
    RequestGate -->|"No"| AccessDenied
    RequestGate -->|"Yes"| OwnerGate
    OwnerGate -->|"No"| AccessDenied["Permission denied"]
    OwnerGate -->|"Yes"| PolicyStore["organizations accessPolicies subcollection"]
    PolicyStore --> PolicyAudit["append-only accessAudit event"]
    PolicyStore --> AccessHook["useOrganizationAccess"]
    AccessHook --> SidebarGate["Sidebar filters denied modules"]
    AccessHook --> ModuleGate["AppShell blocks denied module rendering"]

    classDef ui fill:#e0f7fa,stroke:#00acc1,stroke-width:2px,color:#06202a
    classDef service fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#24102d
    classDef data fill:#fff3e0,stroke:#ff8f00,stroke-width:2px,color:#301d00
    classDef verified fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#0b2c0d
    classDef gate fill:#fce4ec,stroke:#d81b60,stroke-width:2px,color:#3b071a

    class User,Agent,DropUI,Intake,Owner,AccessPane ui
    class CommerceTool,DropService,ReleaseTools,ReleaseCatalog,Readiness,Compiler,Install,Audit,DependencyTree,AccessService,AccessFunctions,AccessHook service
    class DropStore,ReleaseStore,PolicyStore,PolicyAudit,Manifests data
    class DropResult,HonestDrop,ReleaseEvidence,PackageReady,Score,RuntimeAccepted,SidebarGate,ModuleGate verified
    class DropValidate,DropError,ReleaseMatch,NoMatch,QueryError,AuthorityGate,MetadataOnly,DependencyGate,DependencyFix,RequestGate,OwnerGate,AccessDenied gate
```

## Transition breakdown

1. The limited-drop form and commerce agent both submit the same strict draft input to `LimitedDropService`. The service validates product IDs, a non-empty name, and a future timestamp before writing one owner-scoped document to the top-level `limitedDrops` collection.
2. The persisted drop returns its Firestore ID and an explicit `setup_required` notification status. Until a notification provider and consent-aware fan job exist, neither the UI nor the agent may call the drop live or claim that fans were queued or notified.
3. Publishing, Web3, and calendar tools query the owner’s documents from the canonical top-level `proprietaryIngestionReleases` collection. They normalize the supported historical shapes in memory and distinguish a genuine no-match from a permission or database failure.
4. DDEX package readiness starts with typed release metadata but remains `metadata_only` until the sender DPID is verified and every selected recipient has verified onboarding, active credentials, a feed profile, and an accepted validation receipt. Each missing item becomes a named blocker.
5. Dependency repair removes build-only Electron tooling from runtime workspaces, upgrades or constrains vulnerable reachable packages, regenerates the lockfile, and repeats deterministic install, audit, and dependency-tree checks until the production critical/high gate passes.
6. The Access Control pane loads organization member UIDs and policies through callables protected by authentication, App Check, a server-owned entitlement, and Arcjet. It deliberately does not hydrate arbitrary member UIDs from user profiles, preventing the endpoint from becoming a UID-to-email directory. Only the organization owner can change member role or module permissions; the server validates the fixed permission schema and atomically stores both the policy and an append-only audit event.
7. The same access policy is consumed by both navigation and module rendering. Hiding denied navigation is convenience; the AppShell gate is the enforcement boundary that prevents direct module selection from rendering a denied module.
8. Any persistence, authorization, or verification failure terminates at an explicit error state. No fallback converts missing evidence into success, readiness, delivery, or permission.
