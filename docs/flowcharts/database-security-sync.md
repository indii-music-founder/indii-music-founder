# Database Security Rules & Sync Workflow

This diagram maps the automated synchronization and audit process executed by `/db-sync` when codebase schemas or collections shift.

```mermaid
graph TD
    A["Codebase Schema / Collection Shift"] --> B["Initiate /db-sync"]
    
    %% Scans
    B --> C["Phase 1: Codebase Scan"]
    C --> C1["Audit *Service.ts & *Slice.ts"]
    C --> C2["Extract newly queried Firestore collection paths"]
    
    B --> D["Phase 2: Security Rules Audit"]
    D --> D1["Read firestore.rules & storage.rules"]
    D --> D2["Run firebase-security-rules-auditor"]
    
    %% Match & Verify
    C2 --> E{"Paths Match rules?"}
    D2 --> E
    
    E -->|Gaps Found| F["Phase 3: Append Rules & Sync"]
    F -->|Secure public access gates / Limit owned directories| G["Write production-grade rules to firestore.rules"]
    
    E -->|Perfect Sync| H["Phase 4: Run Dry-Run Validation"]
    G --> H
    
    H --> H1["firebase deploy --dry-run"]
    H1 --> I["Output DB-SYNC Compliance Verified"]

    style A fill:#e0f7fa,stroke:#00acc1,stroke-width:2px
    style B fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    style C fill:#efebe9,stroke:#6d4c41,stroke-width:2px
    style D fill:#efebe9,stroke:#ff8f00,stroke-width:2px
    style F fill:#FF00FF,stroke:#8A2BE2,stroke-width:2px
    style I fill:#39FF14,stroke:#228B22,stroke-width:2px
```

## Step-by-Step Transition Breakdown

1. **Extraction Gate (`C1 -> C2`):** When a collection name or query gets touched in services or store slices, `db-sync` scrapes the codebase changes to resolve the exact collection paths.
2. **Rules Audit (`D1 -> D2`):** Concurrently, the rules files are loaded and checked for loose wildcard read/writes or standard owner authentication leaks.
3. **Synchronization Logic (`E -> F -> G`):** If a query path has no matching rule, `Phase 3` resolves the structural gap by drafting production-grade rules (e.g. owner read/write isolates) and appending them safely.
4. **Pruning & Verification (`H -> H1 -> I`):** The final rules are run against Firebase's CLI dry-run validator to guarantee syntactic correctness before completing the compliance check.
