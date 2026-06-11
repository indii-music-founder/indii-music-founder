# Harness MCP & Agent Interaction Flowchart

This flowchart demonstrates how decentralized AI Swarm Agents (like the LegalAgent or MarketingAgent) trigger the deterministic Business Harnesses via the `indii-harness` MCP Server, and how risk is contained.

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
        SkillInject["Injects Product Skills (SKILL.md) into Agent"]
    end

    %% Exposed Tools
    subgraph MCPTools ["Exposed MCP Tools"]
        ListCatalog["`list_harness_catalog()`"]
        CompileHarness["`compile_harness(domain, input)`"]
        GetRun["`get_harness_run(runId)`"]
    end

    %% Core System
    subgraph CoreRails ["indii Business Core"]
        CoreAPI["`compileHarness()` Core API"]
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

1. **Skill Injection:** The `indii-harness` MCP Server isn't just a dumb RPC interface. When an agent connects, the server injects specific Product Skills (via `SKILL.md` files). This teaches the agent *how* and *when* to use the harness tools (e.g., "Always run the Merch Harness before suggesting a new T-shirt drop").
2. **Catalog Discovery:** The agent uses `list_harness_catalog()` to dynamically discover what business domains are currently active or planned in the system.
3. **Execution Request:** The agent calls `compile_harness` with a specific domain and normalized input. 
4. **The Security Boundary:** This is the most important part of the interaction. The MCP server delegates to the deterministic `compileHarness` Core API. The Core API generates the `HarnessRun` payload.
5. **Risk Vocabulary Enforcement:** Before passing the result back across the MCP boundary to the probabilistic AI agent, the **Risk Vocabulary Enforcer** intercepts it. If the `HarnessRun` contains Approval Gates for irreversible actions (like "Spend $500 on ads"), the MCP server *cannot* execute them automatically. It can only return the *Draft* status to the agent, forcing the agent to ask the human user for explicit approval in the UI.
