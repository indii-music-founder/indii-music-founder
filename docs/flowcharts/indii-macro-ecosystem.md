# `indii` Macro Ecosystem Architecture Flowchart

This flowchart visualizes the complete macro-architecture of the `indii` platform. It synthesizes all previous research and feature pillars, connecting the Phase 1 Artist B2B Backend with the Phase 2 Fan B2C Ecosystem to demonstrate the "Closed-Loop Flywheel."

```mermaid
graph TD
    %% Phase 1: Artist Enterprise Hub
    subgraph Phase 1: Artist Enterprise Hub
        ArtistUI["Artist Dashboard (React)"]
        CRM["Superfan CRM & Vault"]
        TourRouter["Algorithmic Tour Router & Merch"]
        SyncTagger["AI Sync Pitch Agent"]
        AICFO["Automated AI CFO Ledger"]
    end

    %% Phase 2: Fan Social Commerce
    subgraph Phase 2: Fan Social Commerce
        FanUI["Fan 'Mini-MySpace' Profile"]
        DigitalVinyl["Digital Vinyl Display Case"]
        GeoBounty["Street Team Geo-Bounties"]
        SecondaryMarket["Fan-to-Fan Trading Floor"]
    end

    %% Core Infrastructure Layer
    subgraph Core Infrastructure & Services
        Genkit["Firebase Genkit (Audio/AI)"]
        Web3["Avalanche Smart Contracts (Royalties)"]
        BigQuery["BigQuery (Data Aggregation)"]
        Stripe["Stripe (Fiat Checkout)"]
    end

    %% Artist Hub Wiring
    ArtistUI --> CRM
    ArtistUI --> TourRouter
    ArtistUI --> SyncTagger
    ArtistUI --> AICFO

    %% The Flywheel Connections (Bridging Phase 1 & 2)
    CRM -- "Launch Exclusive Bundles" --> FanUI
    FanUI --> DigitalVinyl
    FanUI --> GeoBounty
    DigitalVinyl -- "Fans Trade Rare Assets" --> SecondaryMarket

    %% The Financial & Infrastructure Loops
    SecondaryMarket -- "10% Perpetual Royalty Kickback" --> Web3
    Web3 -- "USDC Stablecoin Deposit" --> AICFO
    
    GeoBounty -- "IRL Physical Flyers Drive Scans" --> CRM
    CRM -- "Captures New Fan Data" --> BigQuery
    BigQuery -- "Feeds Geo-Density Analytics" --> TourRouter
    TourRouter -- "Book Show in Dense Market" --> GeoBounty

    SyncTagger -- "Processes Audio" --> Genkit
    SyncTagger -- "Generates Passive Sync Revenue" --> AICFO
    FanUI -- "Purchases Assets (Apple Pay/CC)" --> Stripe
    Stripe -- "Clears Revenue" --> AICFO

    %% HSL Tailored Styling
    classDef artistUI fill:#e0f7fa,stroke:#00acc1,stroke-width:2px,color:#000
    classDef fanUI fill:#fce4ec,stroke:#d81b60,stroke-width:2px,color:#000
    classDef ai fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000
    classDef infra fill:#fff3e0,stroke:#ff8f00,stroke-width:2px,color:#000

    class ArtistUI,CRM,TourRouter,SyncTagger,AICFO artistUI
    class FanUI,DigitalVinyl,GeoBounty,SecondaryMarket fanUI
    class Genkit,SyncTagger ai
    class Web3,BigQuery,Stripe infra
```

## Transition Breakdown

This is how the entire system functions as a continuous, self-sustaining loop:

1. **The Seed (Phase 1 to Phase 2):** The artist uses the **Superfan CRM** to launch an exclusive "Digital Vinyl" and issues a **Geo-Bounty** mission to fans in a specific city. 
2. **The Social Flex (Phase 2):** Fans complete the mission (putting up IRL flyers) and purchase the Digital Vinyl using standard **Stripe** checkout. The assets are displayed on their public **Fan "Mini-MySpace" Profile**, driving FOMO and status among other fans.
3. **The Data Capture (Infrastructure):** When locals scan the IRL flyers put up by the street team, they are funnelled into the CRM. This demographic data is ingested by **BigQuery**.
4. **The Routing (AI & Analytics):** The **Tour Router** constantly analyzes BigQuery. Seeing a massive spike in Chicago due to the Street Team efforts, it automatically plots a profitable tour date there and predicts the exact physical merch inventory needed.
5. **The Perpetual Kickback (Web3 to CFO):** While the artist is on tour, fans trade the limited Digital Vinyl on the **Secondary Market**. The **Avalanche Smart Contract** intercepts these trades, pushing a 10% perpetual royalty directly into the artist's **AI CFO Ledger** in stablecoins, covering their tour gas and lodging without human intervention.
6. **The Passive Engine:** Concurrently, the **AI Sync Tagger** (powered by Genkit) is autonomously pitching their catalog to music supervisors, ensuring revenue is flowing in even when the artist isn't actively marketing.
