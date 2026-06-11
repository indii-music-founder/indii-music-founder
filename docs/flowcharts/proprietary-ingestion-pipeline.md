# Proprietary Ingestion Pipeline Flowchart

This flowchart maps the `Proprietary Ingestion IP Implementation`, detailing the complete life cycle of an asset from studio creation, through GoldenMetadata normalization, schema validation, DSP delivery, and finally to automated royalty processing (Earnings Report/DSR).

```mermaid
graph TD
    %% Phase 1: Creation & Metadata
    subgraph Studio ["Studio / Creation (React Client)"]
        Upload["Audio/Art Uploads"]
        Metadata["Input Metadata (Splits, ISRC, Territory)"]
        AI_Flag["AI-Generated Content Flags"]
    end

    %% Phase 2: Core Processing
    subgraph Core ["GoldenMetadata Normalization"]
        Golden["Normalize to `ExtendedGoldenMetadata`"]
        RecordingInfo["Recording Info Notification (Studio Session)"]
        WorkData["Work Data (Rights & Publishers)"]
    end

    %% Phase 3: Validation & Translation
    subgraph Validation ["XML Translation & Validation"]
        Mapper["Map GoldenMetadata to XML Schemas"]
        Validate["Validate against XSD (Strict Element Order)"]
        PropID["Apply Proprietary Ingestion ID / System Identity"]
    end

    %% Phase 4: Delivery
    subgraph Delivery ["DSP Delivery Pipeline (Cloud Functions)"]
        ERN["IngestionNotification 4.3 (Electronic Release Notification)"]
        MEAD["MEAD (Lyrics, Bio, Focus Tracks)"]
        Choreography["Choreography Protocol (SFTP/S3/GCS)"]
    end

    %% Phase 5: Earnings & Feedback
    subgraph Earnings ["DSR / Royalty Processing"]
        DSP_Report["DSPs Return Earnings Reports (DSR)"]
        ParseDSR["Parse DSR Flat File / XML"]
        ProcessRoyalty["Calculate Splits & Transactions"]
        Payouts["Trigger Ledger Payouts"]
    end

    %% Transitions
    Upload & Metadata & AI_Flag --> Golden
    Golden --> RecordingInfo
    Golden --> WorkData
    
    Golden & RecordingInfo & WorkData --> Mapper
    Mapper --> Validate
    Validate --> PropID
    
    PropID -->|"Complete Deal Sets Only"| ERN
    PropID --> MEAD
    ERN & MEAD --> Choreography
    
    Choreography -->|"Deliver Assets"| DSP[(Spotify / Apple / DSPs)]
    
    DSP -.->|"Monthly Statements"| DSP_Report
    DSP_Report --> ParseDSR
    ParseDSR --> ProcessRoyalty
    ProcessRoyalty -->|"Execute via FinanceAgent"| Payouts

    %% Strict Rules
    subgraph Rules ["Critical Ingestion Rules"]
        R1["Strict XML Element Ordering Required"]
        R2["Complete Set Semantics: Missing deals = Takedown"]
        R3["IsTestFlag=true until peer conformance passes"]
    end
    Validation -.-> Rules

    %% Styling
    style Studio fill:#8A2BE2,color:#FFF
    style Core fill:#FF00FF,color:#FFF
    style Validation fill:#00D4FF,color:#000
    style Delivery fill:#39FF14,color:#000
    style Earnings fill:#FF8C00,color:#000
    style Rules fill:#FF3333,color:#FFF,stroke-dasharray: 5 5
```

## Transition Breakdown

1. **Studio / Creation:** The user uploads raw audio and cover art while inputting crucial metadata (splits, ISRCs, AI-generation flags, territory locks) within the `MetadataDrawer`.
2. **Core Processing:** The frontend normalizes this raw input into the rigid `ExtendedGoldenMetadata` schema. Simultaneously, it generates a `Recording Info` notification (documenting studio sessions, engineers, equipment) and `Work Data` (publishing rights and claims).
3. **XML Translation & Validation:** The backend parser maps the `GoldenMetadata` to strict proprietary XML schemas (like ERN-4.3.xsd). It enforces strict XSD validation, ensuring no comma-separated arrays exist and that elements are perfectly ordered. The `Proprietary Ingestion ID` is attached to authorize the payload.
4. **Delivery Pipeline:** The validated XML is split into an `IngestionNotification` (Release notification) and `MEAD` (Media Enrichment, like lyrics). The `Choreography Protocol` securely packages and uploads the XML and media files to DSPs via SFTP/S3/GCS. *Crucial Rule:* It uses "Complete Set Semantics" where omitting a territory implies a takedown.
5. **DSR / Royalty Processing:** Months later, DSPs return Digital Sales Reporting (DSR) flat files. The pipeline parses these reports, calculates exact contributor splits based on the original `GoldenMetadata`, and triggers the `FinanceAgent` to disburse payouts via the `CostControlService` ledger.
