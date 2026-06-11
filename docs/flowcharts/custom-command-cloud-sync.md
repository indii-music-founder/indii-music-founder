# Custom Command Cloud Sync

This flowchart maps how promoted custom slash commands move between local fallback storage, user cloud storage, and organization/team storage.

```mermaid
graph TD
    UserIntent["User Promotes Conversation Into Slash Command"] --> Composer["EntryCommandService Save Command Path"]
    Composer --> Registry["EntryCommandRegistry Validation"]
    Registry --> ConflictGate{"Built-In Or Custom Conflict?"}
    ConflictGate -->|"Yes"| Reject["Reject With Safe Message"]
    ConflictGate -->|"No"| LocalStore["Local Custom Command Store"]

    LocalStore --> SyncService["EntryCommandSyncService"]
    SyncService --> AuthGate{"Signed In?"}
    AuthGate -->|"No"| LocalOnly["Local Only Until Sign In"]
    AuthGate -->|"Yes"| UserDoc["entryCommands/{uid_commandId}"]

    SyncService --> ScopeGate{"Team Scope Requested?"}
    ScopeGate -->|"No"| UserDoc
    ScopeGate -->|"Yes"| OrgGate{"Current Organization Member?"}
    OrgGate -->|"Yes"| OrgDoc["teamEntryCommands/{orgId_commandId}"]
    OrgGate -->|"No"| UserDoc

    UserDoc --> Hydrate["Load Cloud Commands On Command Resolution"]
    OrgDoc --> Hydrate
    Hydrate --> Merge["Merge Cloud Plus Local Commands"]
    Merge --> Registry

    Registry --> Launch["Known Slash Command Launch"]
    Launch --> Intake["Guided Intake And Harness Routing"]
    Intake --> ApprovalGate["Approval Gate For Paid Public Or Outbound Actions"]

    classDef ui fill:#e0f7fa,stroke:#00acc1,stroke-width:2px,color:#111827;
    classDef service fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#111827;
    classDef data fill:#fff3e0,stroke:#ff8f00,stroke-width:2px,color:#111827;
    classDef gate fill:#fce4ec,stroke:#c2185b,stroke-width:2px,color:#111827;

    class UserIntent,Reject,LocalOnly ui;
    class Composer,Registry,SyncService,Launch,Intake service;
    class LocalStore,UserDoc,OrgDoc,Hydrate,Merge data;
    class ConflictGate,AuthGate,ScopeGate,OrgGate,ApprovalGate gate;
```

## Transition Breakdown

1. `EntryCommandService` receives `/save-command` or a natural promotion phrase and builds a custom command definition from recent conversation context.
2. `EntryCommandRegistry` normalizes the slash name and aliases, then rejects any built-in or already-saved custom command conflict.
3. The command is saved locally first so the app keeps working offline or when Firestore is unavailable.
4. `EntryCommandSyncService` mirrors the command to `entryCommands/{uid_commandId}` when a signed-in user is available.
5. If a team scope is requested and the app has a current organization, the same command can be mirrored to `teamEntryCommands/{orgId_commandId}`. Firestore rules require organization membership.
6. Command resolution hydrates cloud commands before normal launch flows where possible, then merges cloud and local records with built-ins remaining reserved.
7. Saved commands still pass through the same guided intake and approval-gate behavior. Cloud sync never executes paid, public, or outbound actions.
