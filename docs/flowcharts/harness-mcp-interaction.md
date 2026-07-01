# Harness MCP & Agent Interaction Flowchart

This flowchart demonstrates the intended harness contract for decentralized AI Swarm Agents (like the LegalAgent or MarketingAgent) via the `indii-harness` MCP Server, and how risk is contained.

Current state: the MCP server exposes the live harness catalog and static agent guidance, but runtime compilation/retrieval tools return explicit unavailable errors until a Node-safe shared harness backend exists.

```mermaid
graph TD
    %% Swarm Agent Layer
    subgraph AgentSwarm ["Agent Swarm (e.g. Node/Python Runtimes)"]
        Agent["Autonomous Agent (e.g., MarketingAgent)"]
        Planner["Agent Planner / Tool Caller"]
    end

    %% Protocol Boundary
    subgraph MCPBoundary ["Model Context Protocol (MCP) Boundary"]
        MCPServer["indii-harness MCP Server (Local/Shared)"]
        SkillInject["Exposes catalog-driven agent guidance"]
    end

    %% Exposed Tools
    subgraph MCPTools ["Exposed MCP Tools"]
        ListCatalog["`list_harness_catalog()`"]
        CompileHarness["`compile_harness(domain, input)`<br/>Current: unavailable until backend exists"]
        GetRun["`get_harness_run(runId)`<br/>Current: unavailable until backend exists"]
    end

    %% Core System
    subgraph CoreRails ["indii Business Core"]
        CoreAPI["`compileHarness()` Core API<br/>(future shared backend)"]
        RiskVocab["Risk Vocabulary Enforcer"]
    end

    %% Execution Flow
    Agent -->|"Generates Intent"| Planner
    Planner -->|"Discovers Tools via"| MCPServer
    MCPServer -->|"Returns Tools &"| SkillInject
    SkillInject -.->|"Agent learns HOW to use Harnesses"| Agent

    Planner -->|"Calls"| ListCatalog
    ListCatalog -->|"Returns Available Domains"| Planner

    Planner -->|"Calls"| CompileHarness
    CompileHarness -->|"Delegates to"| CoreAPI
    
    CoreAPI -->|"Generates HarnessRun"| RiskVocab
    RiskVocab -->|"Strips Irreversible Actions"| CompileHarness
    
    CompileHarness -->|"Returns safe HarnessRun"| Planner
    Planner -->|"Uses Data in Next Step"| Agent

    %% Security Rule
    subgraph Security ["Security Constraint"]
        Blocker["MCP Server NEVER bypasses Approval Gates"]
    end
    RiskVocab -.->|"Enforces"| Blocker

    %% Styling
    style Agent fill:#8A2BE2,color:#FFF
    style MCPServer fill:#00D4FF,color:#000
    style CoreAPI fill:#FF00FF,color:#FFF
    style RiskVocab fill:#FF3333,color:#FFF
    style Blocker fill:#FF3333,color:#FFF,stroke-dasharray: 5 5
```

## Interaction Breakdown

1. **Catalog-driven guidance:** The `indii-harness` MCP Server exposes the live catalog and static guidance so agents can reason about which harness exists, who owns it, and what kind of approvals it needs.
2. **Catalog discovery:** The agent uses `list_harness_catalog()` to discover the supported harness domains and their ownership/risk metadata.
3. **Runtime requests:** Calls such as `compile_harness`, `get_harness_run`, `list_harness_runs`, `create_boardroom_decision`, and `explain_approval_gates` currently return explicit unavailable errors instead of fabricated runs.
4. **Future security boundary:** When the Node-safe shared harness backend lands, it should delegate to the deterministic `compileHarness()` Core API and return real `HarnessRun` payloads.
5. **Risk vocabulary enforcement:** Once a real run backend exists, approval gates should continue to block irreversible actions instead of auto-executing them.
