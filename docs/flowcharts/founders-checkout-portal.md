# Founders Checkout & Portal Flowchart

This flowchart maps the exclusive Founders Program—a paid feature tier where participating artists gain early access to indii's unreleased features, premium AI agents, and priority support. It details the checkout flow, seat management, and founders-only capability unlocking.

```mermaid
graph TD
    %% Landing
    subgraph Entry ["Entry & Onboarding"]
        FoundersLanding["Founders Program Landing"]
        PricingDisplay["Pricing Tier Display ($2,500/yr)"]
        CTAButton["'Activate Founder Pass' CTA"]
    end

    %% Checkout
    subgraph Checkout ["Manual Off-Platform Buy-In"]
        ManualContact["Contact Sales / Invoice Instructions"]
        PaymentForm["Off-Platform Payment (Wire/ACH)"]
        Confirmation["Manual Payment Confirmation"]
    end

    %% Backend Processing
    subgraph Backend ["Backend (Cloud Functions)"]
        FounderPass["activateFounderPass.ts (Admin/Manual Script)"]
        CreateUser["Create/Update Founder User"]
        SeatAllocation["Allocate Founder Seats (1 owner + N supporters)"]
    end

    %% Firestore Data
    subgraph Data ["Data Persistence"]
        UserDoc["User Doc (founder: true)"]
        FoundersCollection["Firestore `founders` Collection"]
        FounderSeats["Founder Seat Registry"]
    end

    %% Portal
    subgraph Portal ["Founders Portal"]
        PortalDash["Dashboard (Seat Usage, Features)"]
        InviteTeam["Invite Team Members (Supporters)"]
        ManageSeats["Manage Seat Assignments"]
        UnlockedFeatures["Unlocked Features List"]
    end

    %% Feature Gating
    subgraph Gating ["Feature Gating"]
        FeatureFlag["Founder Feature Flags"]
        LockedModule["Locked Modules (e.g., SynthStudio, Merch+AI)"]
        UnlockedModule["Unlocked in Founder App Instance"]
    end

    %% GitHub Integration (Commit Signing)
    subgraph GitHub ["GitHub Integration"]
        GitHubAuth["OAuth to GitHub (User's account)"]
        FounderBadge["FounderBadge Component"]
        SignedCommit["Sign commits with founder-pass token"]
    end

    %% Flow
    FoundersLanding -->|"Browse Tiers"| PricingDisplay
    PricingDisplay -->|"Click Activate"| CTAButton
    CTAButton -->|"Redirect"| ManualContact
    ManualContact -->|"Open Instructions"| PaymentForm
    PaymentForm -->|"Process Payment"| Confirmation
    
    Confirmation -->|"Admin Executes"| FounderPass
    FounderPass -->|"Validate Activation"| CreateUser
    CreateUser -->|"Update Firestore"| UserDoc
    CreateUser -->|"Store Metadata"| FoundersCollection
    CreateUser -->|"Initialize Seats"| SeatAllocation
    SeatAllocation -->|"Registry"| FounderSeats
    
    SeatAllocation -->|"Redirect to Portal"| PortalDash
    PortalDash -->|"View Usage"| FounderSeats
    PortalDash -->|"Email Invites"| InviteTeam
    InviteTeam -->|"Accept Seat"| ManageSeats
    ManageSeats -->|"Sync to Firestore"| FounderSeats
    
    UserDoc -->|"founder=true"| FeatureFlag
    FeatureFlag -->|"Gate via Zustand"| LockedModule
    FeatureFlag -->|"Unlock"| UnlockedModule
    PortalDash -->|"Display List"| UnlockedFeatures
    
    PortalDash -->|"Connect GitHub"| GitHubAuth
    GitHubAuth -->|"Store Token"| UserDoc
    UserDoc -->|"Render Badge"| FounderBadge
    UserDoc -->|"Use Token for Commits"| SignedCommit

    %% Styling
    style FoundersLanding fill:#00D4FF,color:#000
    style PricingDisplay fill:#00D4FF,color:#000
    style CTAButton fill:#00D4FF,color:#000

    style ManualContact fill:#FF8C00,color:#000
    style PaymentForm fill:#FF8C00,color:#000
    style Confirmation fill:#00D4FF,color:#000

    style FounderPass fill:#8A2BE2,color:#FFF
    style CreateUser fill:#8A2BE2,color:#FFF
    style SeatAllocation fill:#8A2BE2,color:#FFF

    style UserDoc fill:#39FF14,color:#000
    style FoundersCollection fill:#39FF14,color:#000
    style FounderSeats fill:#39FF14,color:#000

    style PortalDash fill:#00D4FF,color:#000
    style InviteTeam fill:#00D4FF,color:#000
    style ManageSeats fill:#00D4FF,color:#000
    style UnlockedFeatures fill:#00D4FF,color:#000

    style FeatureFlag fill:#FF00FF,color:#FFF
    style LockedModule fill:#8A2BE2,color:#FFF
    style UnlockedModule fill:#00D4FF,color:#000

    style GitHubAuth fill:#FF8C00,color:#000
    style FounderBadge fill:#00D4FF,color:#000
    style SignedCommit fill:#FF00FF,color:#FFF
```

## Transition Breakdown

1. **Discovery:** User lands on the **Founders Program Landing Page** and sees pricing tiers (e.g., $2,500/yr).

2. **Checkout Initiation:** User clicks **"Activate Founder Pass"**. System directs them to **Contact Sales / Invoice Instructions** for an off-platform manual buy-in.

3. **Payment:** User completes an **Off-Platform Payment (Wire/ACH)** according to the instructions.

4. **Confirmation & Activation:** Upon manual payment confirmation, an admin executes the **`activateFounderPass.ts`** script.

5. **Backend Processing:** The admin script creates or updates the user's Firestore document with `founder: true`, and initializes the **Founder Seat Registry** (1 owner + N supporters).

6. **Portal Access:** User is redirected to the **Founders Portal Dashboard**, where they see:
   - **Seat Usage:** How many founder seats are in use
   - **Invite Team Members:** Email invites for supporters to join the founder account
   - **Manage Seats:** Reassign or revoke seats
   - **Unlocked Features:** A list of exclusive, beta-only modules now available

7. **Feature Gating:** All founder-exclusive features are gated by a **Founder Feature Flag** in the store. When a user has `founder: true`, the **Zustand store** flags unlock previously locked modules (e.g., advanced SynthStudio, Merch+AI).

8. **GitHub Integration:** From the Portal, user can connect their **GitHub account** via OAuth. The access token is stored in Firestore and used to:
   - Display the **Founder Badge** (visual indicator in UI and on GitHub profile)
   - Automatically sign commits to the user's repo with the founder-pass cryptographic key (ownership claim)

