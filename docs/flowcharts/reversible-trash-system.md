# Reversible Trash System

This diagram defines the user-in-the-loop Trash boundary across agents, the
Studio UI, Firestore and Cloud Storage, and the Electron local-filesystem
executor. Agents may list, move, and restore Trash items; only a freshly
reauthenticated user can initiate permanent deletion.

```mermaid
flowchart TD
    User["Authenticated user"] --> FilesUI["Files Dashboard"]
    Agent["AI agent"] --> AgentTools["TrashTools: list, move, restore"]
    AgentTools --> Approval["Tool risk gate: move requires approval"]
    Approval --> TrashService["TrashService and resource adapters"]
    FilesUI --> TrashService

    AgentTools --> NoPurge["No purge tool exists in agent registry"]
    NoPurge --> UserGate["Permanent deletion remains user-only"]

    TrashService --> CloudChoice{"Cloud-backed or local item"}
    CloudChoice -->|"Cloud-backed"| CloudMove["Atomic source mutation and Trash manifest write"]
    CloudMove --> Manifest["users uid trashItems trashId"]
    CloudMove --> CloudSource["Owned source record marked trashed"]

    CloudChoice -->|"Local file"| DesktopBridge["DesktopFileIndexService and preload IPC"]
    DesktopBridge --> MainMove["Electron main-process path and symlink validation"]
    MainMove --> LocalVault["Approved root .indii-trash trashId"]
    MainMove --> Manifest
    Manifest -. "Manifest write failure" .-> Compensation["Restore local payload as compensation"]
    Compensation --> LocalVault

    FilesUI --> Restore["Restore selected item"]
    AgentTools --> Restore
    Restore --> TrashService
    TrashService --> CloudRestore["Cloud adapter restores source and marks manifest restored"]
    TrashService --> LocalRestore["Electron IPC checks destination conflict and restores local payload"]

    FilesUI --> TypedDelete["Type DELETE and complete provider reauthentication"]
    TypedDelete --> FreshToken["Force fresh Firebase ID token"]
    FreshToken --> LocalConfirm["Native Electron confirmation for each local payload"]
    LocalConfirm --> LocalPurge["Remove confirmed local .indii-trash payload"]
    FreshToken --> PurgeService["TrashService permanentlyPurge"]
    LocalPurge --> PurgeService
    PurgeService --> IntentCall["createPurgeIntent callable with App Check"]
    IntentCall --> IntentDoc["Short-lived exact-set purge intent"]
    IntentDoc --> PurgeCall["purgeTrashItems callable with App Check"]
    PurgeCall --> ServerChecks["Ownership, state, retention lock, path, and intent checks"]
    ServerChecks --> CloudDelete["Admin SDK deletes owned payload and source records"]
    ServerChecks --> Audit["Content-free immutable purge audit record"]

    Rules["Firestore and Storage rules"] --> Manifest
    Rules --> IntentDoc
    Rules --> CloudDelete
    Rules --> UserGate

    classDef user fill:#123b52,stroke:#38bdf8,color:#fff
    classDef agent fill:#3b1f5c,stroke:#c084fc,color:#fff
    classDef service fill:#2d1b69,stroke:#8b5cf6,color:#fff
    classDef data fill:#4a2d0b,stroke:#f59e0b,color:#fff
    classDef cloud fill:#123d2d,stroke:#4ade80,color:#fff
    classDef gate fill:#4a1238,stroke:#f472b6,color:#fff
    class User,FilesUI user
    class Agent,AgentTools,Approval agent
    class TrashService,DesktopBridge,MainMove,Restore,CloudRestore,LocalRestore,PurgeService service
    class Manifest,CloudSource,LocalVault,IntentDoc,Audit data
    class CloudMove,IntentCall,PurgeCall,ServerChecks,CloudDelete,LocalPurge cloud
    class NoPurge,UserGate,CloudChoice,Compensation,TypedDelete,FreshToken,LocalConfirm,Rules gate
```

## Transition Breakdown

1. An agent receives only `list_trash`, `move_to_trash`, and
   `restore_from_trash` from `TrashTools.ts`. `ToolRiskRegistry.ts` classifies
   a move as a reversible write requiring approval, and the registry security
   test rejects permanent-delete tool names and executors.
2. Both the agent tools and `FileDashboard.tsx` call `TrashService.ts`.
   `TrashTargetSchema` validates the resource type and stable target ID before
   a registered adapter inspects ownership, retention state, and restore data.
3. For cloud-backed records, the adapter commits the source's trashed state and
   `users/{uid}/trashItems/{trashId}` manifest in one Firestore batch. The
   manifest records provenance, project context, original location, and restore
   data without granting the browser deletion authority.
4. For local files, `DesktopFileIndexService.ts` sends an approved-folder ID,
   relative path, and Trash ID through preload IPC. `system.ts` rejects path
   traversal and symbolic links, then atomically renames the item into
   `.indii-trash/{trashId}`. If the Firestore manifest write fails,
   `TrashService` restores the local payload as compensation.
5. Restore requests return through the same adapter. Cloud adapters restore the
   owned source and transition the manifest to `restored`; Electron rejects an
   occupied destination before renaming a local payload back into the approved
   root.
6. Permanent deletion starts only in the Files Dashboard. The user types
   `DELETE`, reauthenticates with the account's supported provider, and forces a
   fresh ID token. A local payload additionally requires the unbypassable native
   `dialog.showMessageBox` confirmation in the Electron main process.
7. `TrashService.permanentlyPurge` validates canonical, unique Trash IDs and
   validates both callable responses. `createPurgeIntent` binds a five-minute
   token to that exact item set; `purgeTrashItems` consumes it once and checks
   ownership, Trash state, legal hold, and Storage path scope before using the
   Admin SDK.
8. A successful cloud purge removes the owned payload and source records, then
   writes a content-free `TRASH_PERMANENT_PURGE` audit record. Partial failures
   are returned per Trash ID so the UI reports the exact items that remain.
9. Firestore rules let owners read and schema-create manifests, allow only the
   narrow `trashed` to `restored` update, and deny client deletion of manifests
   and purge intents. Storage rules deny all client writes and deletes under the
   Trash quarantine and deny client deletion from general user storage.

## Runtime Invariants

1. No AI-agent declaration, risk entry, or executable registry entry may expose
   purge, empty-trash, hard-delete, or permanent-delete capability.
2. A Trash move is reversible and ownership-scoped; a retention-locked item is
   rejected before its source changes.
3. Permanent deletion requires user reauthentication, exact typed confirmation,
   App Check on both callables, a single-use exact-set intent, and server-side
   policy checks.
4. Local filesystem access is confined to a user-approved root, excludes
   symlinks and traversal, and never exposes `.indii-trash` in normal asset
   search results.
