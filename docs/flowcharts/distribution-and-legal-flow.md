# Distribution, Legal & Royalties Flowchart

This flowchart maps the business operations lifecycle within indii. It details how the LegalAgent parses contracts (splits, record deals), how distribution assets are validated for DSPs (Digital Service Providers like Spotify/Apple Music), and how royalty tracking connects to the global state.

```mermaid
graph TD
    %% UI Components
    subgraph UI ["Business Operations UI"]
        ContractUploader["Legal / Contract Dropzone"]
        DistributionForm["Release Setup Form"]
        RoyaltyDash["Royalty Analytics Dashboard"]
    end

    %% State & Orchestration
    subgraph State ["Client State & Gateway"]
        LegalSlice["Zustand `legalSlice`"]
        DistSlice["Zustand `distributionSlice`"]
        AgentGateway["AgentService Gateway"]
    end

    %% Agents & Logic
    subgraph Agents ["A2A Swarm (Business Suite)"]
        LegalAgent["LegalAgent (Contract Parser)"]
        FinanceAgent["FinanceAgent (Royalty Engine)"]
        ValidationEngine["DSP Validation Rules (Metadata/Audio)"]
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
    LegalAgent -->|"Extracts Splits, Terms, Red Flags"| LegalSlice
    LegalSlice -->|"Saves structured data"| Firestore
    LegalSlice -->|"Updates UI"| ContractUploader

    %% Distribution Flow
    DistributionForm -->|"Inputs Metadata (ISRC, UPC)"| DistSlice
    DistributionForm -->|"Attaches Audio/Art"| ValidationEngine
    ValidationEngine -->|"Checks WAV format, RGB specs"| DistSlice
    
    DistSlice -->|"Saves Release Draft"| Firestore
    DistSlice -->|"Initiates Submission"| SFTP
    SFTP -->|"Delivers DDEX XML + Assets"| DSPs

    %% Royalty Flow
    DSPs -->|"Sends monthly CSV/API reports"| BigQuery
    BigQuery -->|"Aggregates by ISRC/User"| FinanceAgent
    FinanceAgent -->|"Applies Splits from Legal"| Firestore
    Firestore -->|"Populates UI"| RoyaltyDash

    %% Styling
    style ContractUploader fill:#00D4FF,color:#000
    style DistributionForm fill:#00D4FF,color:#000
    style RoyaltyDash fill:#00D4FF,color:#000

    style LegalSlice fill:#8A2BE2,color:#FFF
    style DistSlice fill:#8A2BE2,color:#FFF
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

## Transition Breakdown

1. **Contract Ingestion:** A user uploads a music industry contract (PDF) into the **Legal / Contract Dropzone**. The file is uploaded to **Firebase Storage** and immediately indexed by the **Gemini File Search API** for native RAG capability.
2. **AI Legal Parsing:** The **AgentService Gateway** routes the request to the **LegalAgent**. The LegalAgent natively queries the File Search API to read the document. It uses its deterministic tools to extract strict numerical splits, terms, and potential "red flag" clauses (e.g., perpetual rights).
3. **Structured Persistence:** The parsed JSON data updates the **Zustand `legalSlice`** and is securely saved to **Firestore** `contracts` collection.
4. **Distribution Setup:** The user prepares a release via the **Release Setup Form**. They input required metadata (ISRC, UPC) and attach WAV masters and 3000x3000px artwork.
5. **Asset Validation:** Before submission, the **DSP Validation Rules** engine strictly checks the assets (e.g., rejecting CMYK images or MP3s instead of WAVs), saving valid drafts to the **Zustand `distributionSlice`** and **Firestore**.
6. **Delivery:** Once finalized, the system packages the metadata into DDEX XML format and uses **SFTP Delivery** to push the assets to global **DSPs** (Spotify, Apple Music).
7. **Royalty Aggregation:** Months later, DSPs return massive CSV files of micro-penny streams. These are ingested into **BigQuery** for high-volume analytics.
8. **Split Enforcement:** The **FinanceAgent** reads the BigQuery aggregates and cross-references them with the contract splits saved in Firestore by the LegalAgent. It computes the net earnings per collaborator and populates the **Royalty Analytics Dashboard**.
