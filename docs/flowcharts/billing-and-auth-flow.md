# Billing, Auth & Tier Enforcement Flowchart

This flowchart maps the security and subscription lifecycle. It visualizes how new users onboard, how billing upgrades are handled securely via manual off-platform payments (avoiding client-side spoofing), and how the backend enforces tier limits (e.g., Free vs. Founder) on expensive Cloud Functions.

```mermaid
graph TD
    %% UI & Auth
    subgraph Client ["Client Interface & State"]
        Signup["Auth UI (Login/Signup)"]
        UpgradeUI["Pricing / Upgrade UI"]
        AuthSlice["Zustand `authSlice`"]
        Membership["MembershipService (Feature gating)"]
    end

    %% Auth Provider
    subgraph FirebaseAuth ["Firebase Authentication"]
        AuthSystem["Firebase Auth Service"]
    end

    %% Database
    subgraph Database ["Firestore Database"]
        UserDoc["`users/{uid}` Document"]
    end

    %% Payment Gateway
    subgraph PaymentGateway ["Manual Payment"]
        Checkout["Off-Platform Payment (Wire/ACH)"]
        WebhookTrigger["Manual Payment Confirmation"]
    end

    %% Backend Validation
    subgraph CloudFunctions ["Firebase Cloud Functions"]
        CreateUserHook["`onCreateUser` Trigger"]
        AdminActivationFn["`activateFounderPass` (Admin/Manual Script)"]
        ProtectedAPI["e.g., `generateVideo` (Protected Route)"]
    end

    %% Transitions - Auth Flow
    Signup -->|"Registers/Logs In"| AuthSystem
    AuthSystem -->|"Returns User Credentials"| AuthSlice
    AuthSystem -->|"Fires Auth Trigger"| CreateUserHook
    CreateUserHook -->|"Creates default Free tier profile"| UserDoc

    %% Transitions - Upgrade Flow
        UpgradeUI -->|"Selects Founder Tier"| Checkout
    Checkout -->|"User completes manual payment"| WebhookTrigger
    WebhookTrigger -->|"Admin executes activation script"| AdminActivationFn
    AdminActivationFn -->|"Updates Tier"| UserDoc
    
    %% State Sync
    UserDoc -.->|"onSnapshot real-time listener"| AuthSlice
    AuthSlice -->|"Informs UI of unlock"| Membership
    
    %% Enforcement Flow
    Membership -->|"Allows client to call"| ProtectedAPI
    ProtectedAPI -->|"Reads `tier` directly from DB"| UserDoc
    UserDoc -->|"Validates Quota (Backend check)"| ProtectedAPI

    %% Styling
    style Signup fill:#00D4FF,color:#000
    style UpgradeUI fill:#00D4FF,color:#000
    style AuthSlice fill:#8A2BE2,color:#FFF
    style Membership fill:#8A2BE2,color:#FFF

    style AuthSystem fill:#FF00FF,color:#FFF
    style CreateUserHook fill:#FF8C00,color:#000
    style AdminActivationFn fill:#FF8C00,color:#000
    style ProtectedAPI fill:#FF8C00,color:#000

    style UserDoc fill:#39FF14,color:#000
    
    style Checkout fill:#FF00FF,color:#FFF
    style WebhookTrigger fill:#FF00FF,color:#FFF
```

## Transition Breakdown

1. **Authentication:** A new user registers via the **Auth UI**. **Firebase Auth** handles the credential exchange and populates the local **Zustand `authSlice`**. 
2. **Profile Generation:** Simultaneously, the backend listens for the creation event via the **`onCreateUser`** trigger. It initializes a new document in the **Firestore `users/{uid}`** collection, setting the default `tier: 'free'` and establishing rate limits.
3. **Upgrade Initiation:** When a user hits a paywall or opts into a Founder tier, they interact with the **Pricing / Upgrade UI**, which redirects them out of the application to an **Off-Platform Payment (Wire/ACH)**.
4. **Payment Fulfillment:** Upon successful manual payment, the payment is manually verified.
5. **Database Update:** An **Admin/Manual Script (`activateFounderPass`)** is executed, which safely updates the `tier` and `subscriptionId` fields in the **`users/{uid}` Document**.
6. **Real-time Client Sync:** The frontend **`authSlice`** maintains an active `onSnapshot` listener to the user's Firestore document. When the backend updates the tier to 'founder', the local state updates instantly without a page refresh, prompting the **MembershipService** to unlock the UI features.
7. **Backend Tier Enforcement:** Even if the UI is tricked, expensive operations like **`generateVideo` (Protected Route)** never trust the client payload. They independently read the `tier` field directly from the **`users/{uid}` Document** on the server before spending Vertex AI compute resources.
