# Intelligence Service & Fine-Tuned Model Resolution Fallback

This flowchart visualizes the logic path for initializing AI models via `FirebaseIntelligenceService` and resolving `FineTunedModel` IDs, particularly handling the `VITE_USE_FINE_TUNED_AGENTS` toggle, the `VITE_INTELLIGENCE_MOCK_MODE` (now explicitly blocked), and fallback logic when the network fails or GCP keys have HTTP referrer blocks.

```mermaid
graph TD
    A["User Triggers Action"] --> B["FirebaseIntelligenceService"]
    B --> C{"Check VITE_INTELLIGENCE_MOCK_MODE"}
    
    C -- "true" --> D["Throw AppException (Unsupported)"]
    C -- "false" --> E{"Check VITE_USE_FINE_TUNED_AGENTS"}
    
    E -- "true" --> F["Lookup Agent ID in Registry"]
    F -- "Exists" --> G["Use Fine-Tuned Vertex Model"]
    F -- "Missing" --> H["Throw Error (Strict Enforcement)"]
    
    E -- "false" --> I["Use Fallback Model (e.g. flash)"]
    
    G --> J["Callable Proxy (manageSemanticMemory / Vertex Gateway)"]
    I --> J
    
    J --> K{"AppCheck & Referrer Valid?"}
    K -- "No (403)" --> L["Graceful Degradation / Block Execution"]
    K -- "Yes" --> M["Live GCP Execution"]
    
    M --> N["Update UI / Return Value"]
    
    style A fill:#00D4FF,stroke:#00acc1,stroke-width:2px,color:#000
    style B fill:#8A2BE2,stroke:#6a1b9a,stroke-width:2px,color:#fff
    style C fill:#FF8C00,stroke:#e65100,stroke-width:2px,color:#fff
    style D fill:#FF00FF,stroke:#c51162,stroke-width:2px,color:#fff
    style E fill:#FF8C00,stroke:#e65100,stroke-width:2px,color:#fff
    style F fill:#8A2BE2,stroke:#6a1b9a,stroke-width:2px,color:#fff
    style G fill:#39FF14,stroke:#1b5e20,stroke-width:2px,color:#000
    style H fill:#FF00FF,stroke:#c51162,stroke-width:2px,color:#fff
    style I fill:#39FF14,stroke:#1b5e20,stroke-width:2px,color:#000
    style J fill:#8A2BE2,stroke:#6a1b9a,stroke-width:2px,color:#fff
    style K fill:#FF8C00,stroke:#e65100,stroke-width:2px,color:#fff
    style L fill:#FF00FF,stroke:#c51162,stroke-width:2px,color:#fff
    style M fill:#39FF14,stroke:#1b5e20,stroke-width:2px,color:#000
    style N fill:#00D4FF,stroke:#00acc1,stroke-width:2px,color:#000
```

## Transition Breakdown

1. **Trigger:** A UI action calls the `FirebaseIntelligenceService` for generation, analysis, or memory indexing.
2. **Mock Audit:** The service asserts `VITE_INTELLIGENCE_MOCK_MODE` is strictly `false`. `true` intentionally triggers a terminal `AppException` since live inference is strictly required.
3. **Registry Resolution:** The system checks `VITE_USE_FINE_TUNED_AGENTS`. If `true`, the `FineTunedModel` resolution strict-checks the model registry. Missing agents throw errors immediately instead of silently degrading.
4. **Fallback Handling:** If `USE_FINE_TUNED_AGENTS` is false, it predictably routes to standard production models (e.g., `flash`).
5. **Security Gate:** Calls route through the Firebase functions proxy. AppCheck and Google Cloud API Key HTTP Referrers are evaluated. 403 blocks are caught gracefully, while verified calls succeed and process the live execution.
