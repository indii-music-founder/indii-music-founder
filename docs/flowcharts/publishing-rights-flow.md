# Publishing Rights & Licensing Flowchart

This flowchart maps the publishing rights module—where artists manage mechanical licenses, sync licensing, and publishing administration. It details how indii coordinates with mechanical rights organizations (Harry Fox, MRI) and sync distributors.

```mermaid
graph TD
    %% Composition Metadata
    subgraph Metadata ["Composition Metadata"]
        CompDetails["Composition Details (Title, Duration, Writers)"]
        IswcReg["ISWC Registration (International Standard Musical Work Code)"]
        WriterSplits["Writer & Publisher Splits (e.g., 50/50, 100%)"]
    end

    %% Rights Management
    subgraph RightsEngine ["Rights Management Engine"]
        PublishingAgent["PublishingAgent (Coordination)"]
        MechanicalLicense["Mechanical License Calculator"]
        SyncOpportunity["Sync Licensing Detector"]
        RoyaltyForecast["Royalty Forecast (per right type)"]
    end

    %% External Registries
    subgraph External ["External Rights Organizations"]
        HarryFox["Harry Fox Agency (Mechanical)"]
        MRI["Music Reports Inc. (Sync & Admin)"]
        SoundExchange["SoundExchange (Performance)"]
        Performing["ASCAP/BMI/SESAC (Performance Rights)"]
    end

    %% Licensing
    subgraph Licensing ["Licensing Opportunities"]
        SyncRequests["Incoming Sync Requests (Films, TV, Games)"]
        LicenseNegotiation["Negotiate Terms (Amount, Duration, Territory)"]
        ExecuteGrant["Grant License (Contract + Signature)"]
    end

    %% Data Persistence
    subgraph Data ["Data & Persistence"]
        PubCollection["Firestore (`publishing` collection)"]
        ContractStorage["Cloud Storage (Signed Contracts)"]
        RoyaltyLedger["Royalty Ledger (Per-right tracking)"]
    end

    %% Flow
    CompDetails -->|"Input Metadata"| PublishingAgent
    IswcReg -->|"Register Work"| PublishingAgent
    WriterSplits -->|"Define Shares"| PublishingAgent
    
    PublishingAgent -->|"Calculate Royalty Rate"| MechanicalLicense
    PublishingAgent -->|"Analyze Usage Patterns"| SyncOpportunity
    PublishingAgent -->|"Forecast Revenue"| RoyaltyForecast
    
    MechanicalLicense -->|"Register with"| HarryFox
    HarryFox -->|"Issue License ID"| PubCollection
    
    SyncOpportunity -->|"Monitor Requests"| SyncRequests
    SyncRequests -->|"Approve/Negotiate"| LicenseNegotiation
    LicenseNegotiation -->|"Draft Contract"| PublishingAgent
    PublishingAgent -->|"Esign & File"| ExecuteGrant
    ExecuteGrant -->|"Store Terms"| ContractStorage
    ExecuteGrant -->|"Log Transaction"| RoyaltyLedger
    
    PublishingAgent -->|"Feed metadata to"| MRI
    MRI -->|"Register for Sync Admin"| PubCollection
    
    PublishingAgent -->|"Report compositions to"| SoundExchange
    PublishingAgent -->|"File with"| Performing
    Performing -->|"Royalty Statements"| RoyaltyLedger
    
    RoyaltyForecast -->|"Aggregate Splits"| RoyaltyLedger
    WriterSplits -->|"Distribute per share"| RoyaltyLedger

    %% Styling
    style CompDetails fill:#00D4FF,color:#000
    style IswcReg fill:#00D4FF,color:#000
    style WriterSplits fill:#00D4FF,color:#000

    style PublishingAgent fill:#FF00FF,color:#FFF
    style MechanicalLicense fill:#8A2BE2,color:#FFF
    style SyncOpportunity fill:#8A2BE2,color:#FFF
    style RoyaltyForecast fill:#FF8C00,color:#000

    style HarryFox fill:#FF8C00,color:#000
    style MRI fill:#FF8C00,color:#000
    style SoundExchange fill:#FF8C00,color:#000
    style Performing fill:#FF8C00,color:#000

    style SyncRequests fill:#00D4FF,color:#000
    style LicenseNegotiation fill:#FF00FF,color:#FFF
    style ExecuteGrant fill:#00D4FF,color:#000

    style PubCollection fill:#39FF14,color:#000
    style ContractStorage fill:#39FF14,color:#000
    style RoyaltyLedger fill:#39FF14,color:#000
```

## Transition Breakdown

1. **Composition Metadata:** Artist enters composition details—title, duration, writer names, splits (e.g., 100% writer = artist, or split with co-writers). The **Publishing Agent** reads this input.

2. **ISWC Registration:** The composition is registered with an **ISWC code** (International Standard Musical Work Code), a unique identifier for the work globally.

3. **Mechanical Licensing:** The **Mechanical License Calculator** computes the **statutory mechanical royalty rate** (e.g., $0.091 per track). This is registered with **Harry Fox Agency**, which issues a **License ID** and stores terms in Firestore.

4. **Sync Opportunities:** The **Sync Opportunity Detector** monitors for incoming **Sync Requests** (e.g., a film producer wants to use the track). The **Publishing Agent** reviews, negotiates terms (amount, duration, territory), and either approves or counter-offers.

5. **License Execution:** Once agreed, the **Publishing Agent** drafts a **License Contract**, both parties e-sign, and the contract is filed in **Cloud Storage**. The transaction is logged to the **Royalty Ledger**.

6. **Multi-Organization Registration:** The agent **feeds composition metadata to Music Reports Inc. (MRI)** for **sync administration** (tracking usage across TV, film, games). It also reports to **SoundExchange** (audio performance) and **ASCAP/BMI/SESAC** (broadcast performance).

7. **Royalty Aggregation:** Quarterly, **Royalty Statements** arrive from performing rights organizations. The **Publishing Agent** aggregates all income streams (mechanical, sync, performance) and distributes per **Writer Splits** to collaborators.

8. **Forecast:** The **Royalty Forecast** projects future income across all license types, helping the artist make financial decisions.

