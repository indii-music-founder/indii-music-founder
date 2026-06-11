# Automated Business Manager (AI CFO) Flowchart

This flowchart maps the `indii` AI CFO architecture. It details how the system aggregates multi-channel revenue (touring, sync, Web3, streaming) alongside expenses to provide real-time break-even analysis and automated tax withholding.

```mermaid
graph TD
    %% External Data Ingestion
    PlaidAPI["Plaid API (Bank Sync)"] --> IngestionService["Expense & Income Ingestion"]
    StripeAPI["Stripe API (Vault Subscriptions)"] --> IngestionService
    Web3API["On-chain Payouts (USDC)"] --> IngestionService
    
    %% Analytics & AI Processing
    IngestionService --> BigQuery["BigQuery: Financial Ledger"]
    BigQuery --> AgentCFO["AI CFO Agent (Categorization)"]
    
    %% AI Categorization Logic
    AgentCFO --> MatchLogic{"Is Expense Business or Personal?"}
    MatchLogic -- "Schedule C Deduction" --> TaxVault["Calculate 25% Tax Withholding"]
    MatchLogic -- "Personal" --> Ignore["Ignore for Business Ledger"]
    MatchLogic -- "Ambiguous" --> FlagUI["Flag for Artist Swipe (UI)"]
    
    %% UI Rendering
    TaxVault --> SyncState["Zustand: useFinanceStore()"]
    FlagUI --> SyncState
    SyncState --> RenderDash["React: Financial Health Dashboard"]
    RenderDash --> WarningToast["Alert: 'Break-Even Missed by $400'"]
    
    %% Styling Classes
    classDef ui fill:#e0f7fa,stroke:#00acc1,stroke-width:2px,color:#000
    classDef state fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px,color:#000
    classDef db fill:#fff3e0,stroke:#ff8f00,stroke-width:2px,color:#000
    classDef api fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef ai fill:#f1f8e9,stroke:#33691e,stroke-width:2px,color:#000
    
    class RenderDash,FlagUI,WarningToast ui
    class SyncState,IngestionService state
    class BigQuery db
    class PlaidAPI,StripeAPI,Web3API api
    class AgentCFO,MatchLogic,TaxVault ai
```

## Transition Breakdown
1. **Data Ingestion:** The `IngestionService` securely pulls read-only transaction data via Plaid (credit cards), Stripe (D2F Vault), and on-chain RPCs (Web3 royalties). All data is normalized and stored in a unified BigQuery ledger.
2. **AI Categorization:** An LLM-powered Agent CFO continuously scans new BigQuery rows. It uses heuristic logic and NLP to classify expenses (e.g., automatically tagging a "Guitar Center" purchase as an Equipment Deduction).
3. **Human-in-the-Loop:** If the AI is unsure about a transaction (e.g., an ambiguous "Amazon" purchase), it flags it in the Zustand store. The React UI displays a Tinder-like "Swipe" interface for the artist to manually classify it as Business or Personal.
4. **Calculations & UI:** For all net income, the system calculates a 25-30% estimated tax withholding. The final numbers are pushed to the UI, rendering the massive "Runway & Break-Even" chart and triggering toasts if the artist is dipping below profitability.
