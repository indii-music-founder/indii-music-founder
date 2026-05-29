# Business Harness Wave 1 Architecture

This diagram illustrates the core rails architecture for the Business Harness implemented in Wave 1. It shows how the unified `HarnessCompiler` interface and `HarnessRegistry` are centralized in `@indii/shared`, allowing both the Electron renderer and the `indii-harness` MCP Server to consume and execute domain logic uniformly.

```mermaid
graph TD
    subgraph @indii/shared
        A["HarnessContext + Domain Input"] --> B("compileHarness")
        B --> C{"HarnessRegistry"}
        C --> D["Resolve Domain Compiler"]
        
        subgraph Registered Compilers
            E("SongDnaCompiler")
            F("DistributionDdexCompiler")
            G("CreatorProtectionCompiler")
            H("MerchPodCompiler")
            I("ReleaseHarnessCompiler")
        end
        
        D -.-> E
        D -.-> F
        D -.-> G
        D -.-> H
        D -.-> I
        
        E --> J["createHarnessRun"]
        F --> J
        G --> J
        H --> J
        I -- Adapts legacy result --> J
        
        J --> K["Normalized HarnessRun output"]
    end

    subgraph Renderer Process
        K --> L["Boardroom Meta Harness UI"]
    end

    subgraph Main Process (Electron)
        M["MCPClientService"] --> N("indii-harness MCP Server")
        N --> O["Agent Tool Invocation"]
        O --> A
    end
```

## Description
- **@indii/shared**: The core shared library containing the unified types, registry, and discrete domain compilers.
- **HarnessContext**: Standardized context containing `userId`, `projectId`, and `save` intent.
- **compileHarness / HarnessRegistry**: The single entrypoint for executing business checks. Every domain must register a compiler here.
- **Normalized Output**: Every compiler uses `createHarnessRun` to ensure standardized scoring, findings, recommendations, and agent briefs.
- **Renderer Process**: The front-end React application imports the shared library for direct client-side harness evaluations (e.g., Boardroom UI).
- **indii-harness MCP Server**: A dedicated product MCP server spawned by `MCPClientService` that exposes tools mapping directly to the shared compiler registry, allowing AI Agents to interact with the Business Harness dynamically.

## Transition Breakdown
1. **Agent Tool Invocation**: An AI Agent decides to validate a business assumption and calls an `indii-harness` MCP tool.
2. **MCP Server Routing**: The MCP server maps this call to the shared `HarnessRegistry` and calls `compileHarness`.
3. **Compiler Execution**: The resolved domain compiler runs deterministic rules against the current database state.
4. **HarnessRun Normalization**: The result is normalized into a `HarnessRun` standard output and returned to the agent.
