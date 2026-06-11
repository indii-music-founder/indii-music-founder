# Superfan CRM & Vault Flowchart

This flowchart maps the micro-architecture and state logic for the Superfan CRM & Vault feature within the `indii` app. It details how an artist creates a subscription tier, how the state is managed via Zustand, and how the data persists to Firestore and Stripe.

```mermaid
graph TD
    %% User Actions / UI Components
    CreateTierBtn["Click 'Create Vault Tier'"] --> TierModal["Subscription Tier Modal (UI)"]
    TierModal --> SubmitTier["Submit Tier Config (Price, Name)"]
    
    %% Zustand State Layer
    SubmitTier --> VaultSlice["Zustand: useVaultStore()"]
    VaultSlice --> SetLoading["setLoading(true)"]
    
    %% Service Logic Layer
    SetLoading --> VaultService["VaultService.createTier()"]
    VaultService --> AuthCheck{"Check auth.currentUser"}
    
    AuthCheck -- "Valid User" --> StripeAPI["Stripe API: Create Product & Price"]
    AuthCheck -- "Invalid" --> ErrorState["Throw Auth Error"]
    
    %% External API & Database Layer
    StripeAPI -- "Success (Returns Price ID)" --> FirestoreTiers["Firestore: users/{uid}/subscriptionTiers"]
    StripeAPI -- "Failed" --> ErrorState
    
    FirestoreTiers -- "Document Written" --> UpdateState["Zustand: Update local tiers array"]
    UpdateState --> SetSuccess["setLoading(false), show Toast"]
    
    %% Styling Classes
    classDef ui fill:#e0f7fa,stroke:#00acc1,stroke-width:2px,color:#000
    classDef state fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#000
    classDef db fill:#fff3e0,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef api fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef err fill:#ffebee,stroke:#c62828,stroke-width:2px,color:#000
    
    %% Apply Styling
    class CreateTierBtn,TierModal,SubmitTier ui
    class VaultSlice,SetLoading,UpdateState,SetSuccess state
    class VaultService AuthCheck state
    class FirestoreTiers db
    class StripeAPI api
    class ErrorState err
```

## Transition Breakdown

1. **User Action:** The artist clicks the "Create Vault Tier" button on the CRM dashboard, opening the `TierModal` React component. They input the tier name, description, and monthly price.
2. **State Trigger:** Submitting the form calls an action in the `vaultSlice` Zustand store. The store immediately sets `isLoading = true` to update the UI and prevent duplicate submissions.
3. **Service Execution:** The Zustand action delegates the heavy lifting to `VaultService.createTier()`. The service first verifies the `auth.currentUser` object from the `authSlice`. If invalid, it short-circuits to an error state.
4. **Stripe Integration (The 2-Strike Protocol):** If authenticated, the service calls the Stripe API to create a new Product and an associated recurring Price object. If this network call fails or times out, the service will implement a retry mechanism. If it fails twice, it aborts, logs the error, and alerts the user.
5. **Firestore Persistence:** Upon receiving a successful `price_id` from Stripe, the service writes a new document to the `users/{userId}/subscriptionTiers` Firestore subcollection. This document links the local tier metadata with the Stripe `price_id`.
6. **State Resolution:** Once the Firestore write is confirmed, the service returns success to the Zustand store. The store appends the new tier to the local `tiers` array, sets `isLoading = false`, and triggers a success toast notification in the UI.
