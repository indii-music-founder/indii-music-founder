# Finance Data Subscription Guard Flowchart

This flowchart maps the lifecycle of the `useFinance` hook subscriptions, detailing the initialization safeguards and E2E authentication/mocking error bypass mechanisms.

```mermaid
graph TD
    %% Component Mount & Hook Trigger
    Mount["Component Mounts / useFinance() Called"] --> ProfileCheck{"Check userProfile.id"}
    
    %% Profile ID Check
    ProfileCheck -- "'pending'" --> BlockSub["Defer Subscription & Set loading = false"]
    ProfileCheck -- "Valid UID" --> CheckAuth{"Check auth.currentUser"}
    
    %% Auth Check
    CheckAuth -- "Null / Resolving" --> FirebaseListen["Initiate query / onSnapshot"]
    CheckAuth -- "Matches UID" --> FirebaseListen
    CheckAuth -- "Misaligned UID (E2E Mock)" --> GuardBlock{"Guard: auth.currentUser.uid !== userId?"}
    
    %% Guard Block
    GuardBlock -- "Yes" --> ErrorLog["logger.error('Unauthorized subscribe')"]
    GuardBlock -- "No" --> FirebaseListen
    
    %% Firestore / E2E Intercept
    FirebaseListen --> ConnectionType{"Is E2E Test Suite?"}
    ConnectionType -- "Yes" --> InterceptRoute["Playwright route() Intercepts Listen Stream"]
    ConnectionType -- "No" --> DirectFirestore["Establish Live WebChannel / REST connection"]
    
    %% End States
    InterceptRoute --> RenderData["Mock Data/Empty Array Pushed to State"]
    DirectFirestore --> RenderData
    ErrorLog --> E2EFilter{"Playwright runner console listener"}
    
    %% Filtering Warnings
    E2EFilter -- "Contains 'Unauthorized subscribe'" --> IgnoreLog["Ignore / Prevent Test Failure"]
    E2EFilter -- "Other Errors" --> FailTest["Record Error & Fail Test Case"]
    
    RenderData --> SyncUI["React Component Update / Renders Chart & Lists"]
    
    %% Styling Classes
    classDef hook fill:#e0f7fa,stroke:#00acc1,stroke-width:2px,color:#000
    classDef logic fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#000
    classDef guard fill:#fff3e0,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef net fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef e2e fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000
    
    class Mount,SyncUI hook
    class ProfileCheck,CheckAuth logic
    class GuardBlock,ErrorLog guard
    class FirebaseListen,DirectFirestore net
    class ConnectionType,InterceptRoute,E2EFilter,IgnoreLog,FailTest e2e
```

## Transition Breakdown

1. **Onboarding / Initial State Guard:** When the application first loads, the user profile in the Zustand store is initialized with `id: 'pending'`. The `useFinance` hook intercept catches this pending state in its `useEffect` dependencies, preventing it from invoking `subscribeToEarnings` or `subscribeToExpenses` with the mock identifier.
2. **Authentication Guard:** Once the profile resolves to a valid UID, it is cross-referenced with `auth.currentUser`. Under normal operational parameters, these match, and a live Firestore listener is established via `onSnapshot`.
3. **E2E Emulation Guard:** During direct-navigation E2E specialist tests, the auth state can momentarily desynchronize from the mock profile ID. If a misalignment triggers, `FinanceService` issues an unauthorized log message. The Playwright console listener in `live_tests_runner.spec.ts` intercepts this message, filters it out to prevent false-positive failures, and allows the test to verify visual layout integrity under mock conditions.
