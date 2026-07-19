---
description: Complete mapping of the user's financial journey, from free tier signup through Stripe checkout and the backend synchronization of premium feature unlocks.
---

# Billing, Subscription & Tier Enforcement

This flowchart visualizes the lifecycle of user access control. It tracks the flow of a user converting from the Free Tier, successfully completing a Stripe checkout, and the subsequent webhooks and synchronization events that eventually grant them access to the "Founders" tier features.

```mermaid
graph TD
    %% ╔══════════════════════════════════════════╗
    %% ║        USER JOURNEY                      ║
    %% ╚══════════════════════════════════════════╝
    subgraph USER_JOURNEY ["User Journey"]
        SIGNUP["New User Signup"]
        FREE_TIER["Free Tier<br/>(Default State)"]
        PAYWALL["Feature Paywall<br/>(MembershipService Gate)"]
        PRICING["Pricing / Upgrade UI"]
        FOUNDERS_CK["Founders Checkout UI"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        PAYMENT PROCESSING                ║
    %% ╚══════════════════════════════════════════╝
    subgraph PAYMENT ["Stripe Payment Processing"]
        STRIPE_CHECKOUT["Stripe Hosted Checkout"]
        STRIPE_WH["Stripe Webhook<br/>(invoice.paid)"]
        CF_STRIPE["Cloud Function: handleStripeWebhook"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        BACKEND ENFORCEMENT               ║
    %% ╚══════════════════════════════════════════╝
    subgraph ENFORCEMENT ["Backend Security Enforcement"]
        USER_DOC["Firestore: users/{uid}<br/>(tier: 'founder')"]
        COST_CIRCUIT["CostCircuitBreaker<br/>(Agent Generation Caps)"]
        QUOTA_SVC["StorageQuotaService<br/>(File Upload Caps)"]
    end

    %% ╔══════════════════════════════════════════╗
    %% ║        CLIENT-SIDE SYNC                  ║
    %% ╚══════════════════════════════════════════╝
    subgraph CLIENT_SYNC ["Client-Side Reactivity"]
        SNAPSHOT["Firestore onSnapshot"]
        SUBSCRIPTION_SLICE["subscriptionSlice<br/>(tier state updated)"]
        MEMBERSHIP_SVC["MembershipService<br/>(Feature UI Unlocked)"]
    end

    %% Connections
    SIGNUP -->|"Firebase Auth"| FREE_TIER
    FREE_TIER -->|"onCreateUser trigger"| USER_DOC
    FREE_TIER --> PAYWALL
    PAYWALL --> PRICING
    PRICING --> FOUNDERS_CK
    FOUNDERS_CK --> STRIPE_CHECKOUT

    STRIPE_CHECKOUT --> STRIPE_WH
    STRIPE_WH --> CF_STRIPE
    CF_STRIPE -->|"Updates tier field"| USER_DOC

    USER_DOC --> COST_CIRCUIT
    USER_DOC --> QUOTA_SVC

    USER_DOC -.->|"Real-time sync"| SNAPSHOT
    SNAPSHOT --> SUBSCRIPTION_SLICE
    SUBSCRIPTION_SLICE --> MEMBERSHIP_SVC
    MEMBERSHIP_SVC -.->|"Dismisses"| PAYWALL

    classDef user fill:#00D4FF,stroke:#0077AA,stroke-width:2px,color:#001018
    classDef stripe fill:#6366F1,stroke:#4338CA,stroke-width:2px,color:#FFFFFF
    classDef backend fill:#FF8C00,stroke:#AA5500,stroke-width:2px,color:#001018
    classDef sync fill:#39FF14,stroke:#1A8800,stroke-width:2px,color:#001018

    class SIGNUP,FREE_TIER,PAYWALL,PRICING,FOUNDERS_CK user
    class STRIPE_CHECKOUT,STRIPE_WH,CF_STRIPE stripe
    class USER_DOC,COST_CIRCUIT,QUOTA_SVC backend
    class SNAPSHOT,SUBSCRIPTION_SLICE,MEMBERSHIP_SVC sync
```

## Transition Breakdown

1. **Free Tier Initialization**: A new user signs up via Firebase Auth. The `onCreateUser` Cloud Function trigger builds their initial `users/{uid}` document, explicitly setting their `tier` to `free`.
2. **Paywall Interception**: The user attempts an action (e.g., unlimited AI generation, heavy video rendering). The client-side `MembershipService` or backend `CostCircuitBreaker` intercepts the request and presents the Paywall UI.
3. **Checkout Handoff**: The user navigates to the Founders Checkout UI and is handed off to a secure Stripe Hosted Checkout session.
4. **Webhook Synchronization**: Upon successful credit card charge, Stripe fires an `invoice.paid` webhook to the dedicated `handleStripeWebhook` Cloud Function. This function securely updates the user's `tier` field in Firestore to `founder` and applies the relevant `subscriptionId`.
5. **Backend Quota Adjustments**: The newly upgraded `users/{uid}` document automatically grants the user higher ceilings in the `CostCircuitBreaker` (agent inference budget) and `StorageQuotaService` (cloud asset storage).
6. **Real-time Client Sync**: Because the client maintains an active `onSnapshot` listener on their user document, the tier upgrade propagates instantly to the Zustand `subscriptionSlice`. The `MembershipService` detects the state change and automatically dismisses the paywall modal, granting immediate, seamless access to the platform without requiring a hard refresh.
