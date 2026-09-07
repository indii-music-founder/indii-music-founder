# Distribution, Legal & Royalties Flowchart

This flowchart maps the business operations lifecycle within indii. It details how the LegalAgent parses contracts (splits, record deals), how distribution assets undergo Pre-Flight Audio & Acoustic QC (LUFS compliance, acoustic DSP) and DSP validation for streaming platforms, and how royalty tracking ingests distributor statements through Royalty Statement Forensics (absorbed Format Foundry engine) into verified earnings and global state.

```mermaid
graph TD
    %% UI Components
    subgraph UI ["Business Operations UI"]
        ContractUploader["Legal / Contract Dropzone"]
        DistributionForm["Release Setup Form"]
        PreFlightQC["Pre-Flight Audio & Acoustic QC (QCPanel)"]
        StatementForensics["Royalty Statement Forensics (Format Foundry Engine)"]
        RoyaltyDash["Royalty Analytics Dashboard"]
    end

    %% State & Orchestration
    subgraph State ["Client State & Gateway"]
        LegalService["LegalService & Contract Store"]
        DistSlice["Zustand `distributionSlice`"]
        FinanceSlice["Zustand `financeSlice`"]
        AgentGateway["indii Conductor (AgentGraphService)"]
    end

    %% Agents & Logic
    subgraph Agents ["A2A Swarm (Business Suite)"]
        LegalAgent["LegalAgent (Contract Parser)"]
        FinanceAgent["FinanceAgent (Royalty Engine)"]
        ValidationEngine["DSP Validation Rules (Metadata/Audio/LUFS)"]
    end

    %% Cloud Storage & Database
    subgraph GCP ["Google Cloud Platform"]
        FileSearch["Gemini File Search API (Contract Memory)"]
        Firestore["Firestore (`contracts`, `releases`, `royalties`)"]
        CloudStorage["Firebase Storage (`gs://`)"]
        BigQuery["BigQuery (Revenue Analytics)"]
    end

    %% External Systems
    subgraph External ["External Delivery"]
        DSPs["DSPs (Spotify, Apple Music, TikTok)"]
        SFTP["SFTP Delivery / Distributor API"]
    end

    %% Legal Flow
    ContractUploader -->|"Uploads PDF/Doc"| CloudStorage
    CloudStorage -->|"Triggers indexing"| FileSearch
    ContractUploader -->|"Notifies via Gateway"| AgentGateway
    AgentGateway -->|"Delegates Analysis"| LegalAgent
    
    LegalAgent <-->|"Retrieves context from"| FileSearch
    LegalAgent -->|"Extracts Splits, Terms, Red Flags"| LegalService
    LegalService -->|"Saves structured data"| Firestore
    LegalService -->|"Updates UI"| ContractUploader

    %% Distribution Flow
    DistributionForm -->|"Inputs Metadata (ISRC, UPC)"| DistSlice
    DistributionForm -->|"Attaches Audio Master (.wav/.flac)"| PreFlightQC
    PreFlightQC -->|"Acoustic DSP & LUFS Compliance Check"| ValidationEngine
    ValidationEngine -->|"Validates true peak, LUFS, RGB artwork"| DistSlice
    
    DistSlice -->|"Saves Release Draft"| Firestore
    DistSlice -->|"Initiates Submission"| SFTP
    SFTP -->|"Delivers DDEX XML + Assets"| DSPs

    %% Royalty Flow
    DSPs -->|"Sends monthly CSV/API statements"| StatementForensics
    StatementForensics -->|"Audits & normalizes statements into verified earnings"| FinanceSlice
    FinanceSlice -->|"Streams normalized records"| BigQuery
    BigQuery -->|"Aggregates by ISRC/User"| FinanceAgent
    FinanceAgent -->|"Applies Splits from Legal"| Firestore
    Firestore -->|"Populates UI"| RoyaltyDash

    %% Styling
    style ContractUploader fill:#00D4FF,color:#000
    style DistributionForm fill:#00D4FF,color:#000
    style PreFlightQC fill:#00D4FF,color:#000
    style StatementForensics fill:#00D4FF,color:#000
    style RoyaltyDash fill:#00D4FF,color:#000

    style LegalService fill:#8A2BE2,color:#FFF
    style DistSlice fill:#8A2BE2,color:#FFF
    style FinanceSlice fill:#8A2BE2,color:#FFF
    style AgentGateway fill:#8A2BE2,color:#FFF

    style LegalAgent fill:#FF00FF,color:#FFF
    style FinanceAgent fill:#FF00FF,color:#FFF
    style ValidationEngine fill:#FF00FF,color:#FFF

    style FileSearch fill:#39FF14,color:#000
    style Firestore fill:#39FF14,color:#000
    style CloudStorage fill:#39FF14,color:#000
    style BigQuery fill:#39FF14,color:#000

    style DSPs fill:#FF8C00,color:#000
    style SFTP fill:#FF8C00,color:#000
```

## Step-by-Step Transition Breakdown

1. **Contract Ingestion:** A user uploads a music industry contract (PDF) into the **Legal / Contract Dropzone**. The file is uploaded to **Firebase Storage** and immediately indexed by the **Gemini File Search API** for native RAG capability.
2. **AI Legal Parsing:** The **indii Conductor** routes the request to the **LegalAgent**. The LegalAgent natively queries the File Search API to read the document. It uses its deterministic tools to extract strict numerical splits, terms, and potential "red flag" clauses (e.g., perpetual rights).
3. **Structured Persistence:** The parsed JSON data is processed by **`LegalService`** and securely saved to the **Firestore** `contracts` collection.
4. **Distribution Setup:** The user prepares a release via the **Release Setup Form**, entering required metadata (ISRC, UPC, contributors) and attaching lossless WAV/FLAC masters and 3000x3000px artwork.
5. **Pre-Flight Audio & Acoustic QC:** Master audio files pass through the integrated **Pre-Flight Audio & Acoustic QC** panel (`QCPanel.tsx`), absorbed into Distribution from the legacy tools drawer. The panel runs native acoustic DSP and LUFS compliance metering (evaluating Spotify -14 LUFS, Apple Music -16 LUFS, and true peak ceiling).
6. **Asset Validation & Release Packaging:** The **DSP Validation Rules** engine certifies technical compliance (rejecting lossy audio, non-RGB artwork, or out-of-spec loudness). Verified drafts are committed to the **Zustand `distributionSlice`** and persisted in **Firestore**.
7. **Delivery:** Once finalized, the system packages the metadata into standard DDEX XML and uses **SFTP Delivery** to push the assets to global **DSPs** (Spotify, Apple Music, Tidal).
8. **Royalty Statement Forensics:** When distributors return monthly revenue CSVs/APIs, files are ingested into the **Royalty Statement Forensics** tab (absorbed Format Foundry engine) under the **Finance Department**. The engine audits and normalizes disparate distributor columns into verified earnings records before streaming to **BigQuery**.
9. **Split Enforcement & Analytics:** The **FinanceAgent** queries the BigQuery aggregates and cross-references them with the contract splits saved in Firestore by the LegalAgent. It computes net earnings per collaborator and populates the **Royalty Analytics Dashboard**.
