# Guest Auth Retirement Flowchart

Purpose: map the production path that currently creates anonymous Firebase users,
and the guarded target path that prevents guest sessions from touching cloud
state.

```mermaid
graph TD
    UserClick["User clicks Explore as Guest"] --> LoginForm["LoginForm.tsx"]
    LoginForm --> AuthSlice["authSlice.loginAsGuest"]
    AuthSlice --> AnonymousGate{"Firebase E2E mock enabled"}
    AnonymousGate -->|"No"| FailClosed["Throw guest login disabled"]
    AnonymousGate -->|"Yes"| MockAuth["E2E mock auth user"]

    EmailSignIn["Email or Google sign-in"] --> AuthListener["initializeAuthListener"]
    MockAuth --> AuthListener
    AuthListener --> IsAnon{"user.isAnonymous"}
    IsAnon -->|"Yes"| LocalOnly["Set auth state only and skip Firestore sync"]
    IsAnon -->|"No"| UserDoc["users/{uid} profile sync"]

    LocalOnly --> GuardedServices["Shared auth guard"]
    UserDoc --> GuardedServices
    GuardedServices --> ProfileRepo["profile and repository storage"]
    GuardedServices --> ProjectRelay["project and remote relay services"]
    GuardedServices --> BrandAssets["brand asset upload and generation"]
    GuardedServices --> Rules["Firestore and Storage rules"]

    ProfileRepo --> CloudDenied{"Anonymous or demo user"}
    ProjectRelay --> CloudDenied
    BrandAssets --> CloudDenied
    Rules --> CloudDenied
    CloudDenied -->|"Yes"| NoWrite["No cloud write"]
    CloudDenied -->|"No"| CloudWrite["Authorized cloud write"]

    style UserClick fill:#e0f7fa,stroke:#00acc1,stroke-width:2px
    style LoginForm fill:#e0f7fa,stroke:#00acc1,stroke-width:2px
    style AuthSlice fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    style AuthListener fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    style AnonymousGate fill:#fff3e0,stroke:#ff8f00,stroke-width:2px
    style IsAnon fill:#fff3e0,stroke:#ff8f00,stroke-width:2px
    style FailClosed fill:#ffebee,stroke:#d81b60,stroke-width:2px
    style NoWrite fill:#ffebee,stroke:#d81b60,stroke-width:2px
    style CloudWrite fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style Rules fill:#efebe9,stroke:#ff8f00,stroke-width:2px
```

## Transition Breakdown

1. The visible guest control in `LoginForm.tsx` no longer routes production users
   into Firebase anonymous auth.
2. `authSlice.loginAsGuest()` becomes an explicit test/mock-only entry point.
   Outside Firebase E2E mock mode, it fails before calling
   `signInAnonymously()`.
3. The auth listener still accepts real email and Google users, but checks
   `user.isAnonymous` before syncing `users/{uid}`.
4. Existing anonymous sessions are treated as local-only state and must not
   trigger Firestore profile creation or last-login updates.
5. A shared guard keeps profile, storage, project, relay, brand asset, and rules
   logic consistent instead of relying on scattered `founder-demo-uid` checks.
6. Firestore and Storage rules should not grant anonymous guest write access.
   Any cleanup of already-created anonymous records remains a separate
   dry-run-first work order.
