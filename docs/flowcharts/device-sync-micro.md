---
description: Micro-architecture mapping the cross-device sync handshake and the somatic Brand HQ assets integration.
---

# Cross-Device Sync & Brand Assets Integration

This flowchart illustrates the technical implementation of:
1. **The Cross-Device Sync Handshake**: Resolving the race condition between Auth, asynchronous Profile loading, and real-time Firestore subscriptions (History/Projects).
2. **Somatic Brand Assets Flow**: The mapping of assets uploaded in the Brand Manager (Brand HQ) into the Creative Studio (Art Department) Character Library.

```mermaid
graph TB
    %% ╔══════════════════════════════════════════╗
    %% ║         LIFECYCLE TRIGGERS               ║
    %% ╚══════════════════════════════════════════╝
    subgraph LIFECYCLE ["🔄 App Lifecycle Startup"]
        AUTH_START["Firebase Auth Resolves"] -->|Trigger Effect 1| AUTH_LSTN["initializeAuthListener()"]
        AUTH_LSTN -->|Set User State| ST_USER["Zustand: user (uid)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║         PROFILE & ORG RESOLUTION         ║
    %% ╚══════════════════════════════════════════╝
    subgraph ORG_RESOLUTION ["📂 Profile & Org Resolution"]
        ST_USER -->|Trigger Effect 2| LOAD_PROF["loadUserProfile(uid)"]
        LOAD_PROF -->|Async fetch profile| FS_PROF["Firestore: /profiles/{uid}"]
        FS_PROF -->|Resolve Profile| ST_ORG["Zustand: currentOrganizationId <br/>(e.g., 'personal' or 'org-123')"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║         SYNC HYDRATION TRIGGER           ║
    %% ╚══════════════════════════════════════════╝
    subgraph SYNC_TRIGGER ["📡 Sync & Hydration (AppInitializationProvider)"]
        ST_USER -->|Trigger Effect 3| INIT_SYNC["initializeHistory() & loadProjects()"]
        ST_ORG -->|Reactive Dependency Update| INIT_SYNC
        
        INIT_SYNC -->|1. Clean old listeners| UNSUB["Clean up old Unsubscribe callback"]
        UNSUB -->|2. Establish new subscription| SUB_REAL["StorageService.subscribeToHistory(orgId)"]
        SUB_REAL -->|Listen to Firestore| FS_HIST["Firestore: /history"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║         CROSS-DEVICE PERSISTENCE         ║
    %% ╚══════════════════════════════════════════╝
    subgraph CROSS_DEVICE ["📱 Cross-Device Synchronization"]
        LAPTOP["💻 Laptop Session"] -->|Generate Image| GEN_IMG["saveItem(HistoryItem)"]
        GEN_IMG -->|Save to Firestore| FS_HIST
        FS_HIST -.->|Real-time update| SUB_REAL
        SUB_REAL -->|Sync history array| ST_HIST["Zustand: generatedHistory[]"]
        ST_HIST -.->|Render updated assets| IPAD["📱 iPad Session (app.indii.music)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║         SOMATIC BRAND ASSETS FLOW        ║
    %% ╚══════════════════════════════════════════╝
    subgraph SOMATIC_ASSETS ["🧬 Somatic Brand Assets Flow"]
        BRAND_HQ["🏢 Brand Manager (Brand HQ)"] -->|Upload profile images| UPL_ASSET["Save to userProfile.brandKit.brandAssets[]"]
        UPL_ASSET -->|Firestore Save| FS_PROF
        
        FS_PROF -.->|Loaded on AppInit| ST_PROF["Zustand: userProfile"]
        ST_PROF -->|Retrieve brandAssets| CHAR_LIB["🎨 Creative Studio: CharacterLibrary"]
        CHAR_LIB -->|Render 'Import from Brand HQ'| UI_STUDIO["Studio UI: Import Grid"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║              STYLE CLASSES               ║
    %% ╚══════════════════════════════════════════╝
    classDef trigger fill:#1E293B,stroke:#94A3B8,stroke-width:2px,color:#F1F5F9
    classDef state fill:#0B230C,stroke:#39FF14,stroke-width:2px,color:#F8FAFC
    classDef backend fill:#2E150C,stroke:#FB923C,stroke-width:2px,color:#F8FAFC
    classDef client fill:#0B1C3D,stroke:#60A5FA,stroke-width:2px,color:#F8FAFC
    classDef service fill:#2E1A08,stroke:#FF8C00,stroke-width:2px,color:#F8FAFC

    class AUTH_START,LOAD_PROF,INIT_SYNC,UNSUB,UPL_ASSET trigger
    class ST_USER,ST_ORG,ST_HIST,ST_PROF state
    class FS_PROF,FS_HIST backend
    class LAPTOP,IPAD,UI_STUDIO,BRAND_HQ client
    class AUTH_LSTN,SUB_REAL,CHAR_LIB service
```

## Step-by-Step Sync Handshake

1. **Auth Lifecycle Initiation**: On application startup, the Firebase Auth state resolves and sets `state.user` in the Zustand store.
2. **Asynchronous Profile Fetch**: Once the authenticated user state is populated, Effect 2 triggers `loadUserProfile(uid)`, fetching the user's profile documents containing their active organization IDs.
3. **Reactive Organization Sync**: While the profile document loads, the global store holds a placeholder/default organization ID (`'org-default'`).
4. **Subscription Hot-Reload**: Once the profile document loads and updates the Zustand store's `currentOrganizationId`, the `AppInitializationProvider` detects the dependency change, tears down the placeholder subscriptions, and establishes the durable real-time Firestore listeners (`subscribeToHistory()`) and metadata fetches (`loadProjects()`) on the correct, active organization.
5. **Cross-Device Rendering**: When an image or video asset is generated on a laptop, it is pushed to Firestore `/history` using the active organization ID. The iPad session, listening in real-time to that same organization ID, immediately receives the update and renders the history changes.
6. **Somatic Brand HQ Assets**: Assets uploaded in the Brand Manager are saved directly to `userProfile.brandKit.brandAssets` inside the user profile document. When loading the Creative Studio, the Character Library pulls from `userProfile` and surfaces an "Import from Brand HQ" grid, allowing direct use of these face photos and brand logos in generated visuals.
