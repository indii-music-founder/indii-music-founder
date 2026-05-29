# Business Harness Wave 1 Architecture

This diagram illustrates the core rails architecture for the Business Harness implemented in Wave 1. It shows how the unified `HarnessCompiler` interface and `HarnessRegistry` replace ad-hoc implementations, allowing orchestrators like Upload Intake and Boardroom to uniformly invoke and consume results.

```mermaid
graph TD
    A[HarnessContext + Domain Input] --> B(compileHarness)
    B --> C{HarnessRegistry}
    C --> D[Resolve Domain Compiler]
    
    subgraph Registered Compilers
        E(SongDnaCompiler)
        F(DistributionDdexCompiler)
        G(CreatorProtectionCompiler)
        H(MerchPodCompiler)
        I(ReleaseHarnessCompiler)
    end
    
    D -.-> E
    D -.-> F
    D -.-> G
    D -.-> H
    D -.-> I
    
    E --> J[createHarnessRun]
    F --> J
    G --> J
    H --> J
    I -- Adapts legacy result --> J
    
    J --> K[Normalized HarnessRun output]
    K --> L[Boardroom Meta Harness]
```

## Description
- **HarnessContext**: Standardized context containing `userId`, `projectId`, and `save` intent.
- **compileHarness / HarnessRegistry**: The single entrypoint for executing business checks. Every domain must register a compiler here.
- **Registered Compilers**: Existing domains have been refactored or adapted into discrete compilers to honor the `HarnessCompiler` interface.
- **Normalized Output**: Every compiler uses `createHarnessRun` to ensure standardized scoring, findings, recommendations, and agent briefs. Boardroom uses this unified shape to evaluate business impacts.
