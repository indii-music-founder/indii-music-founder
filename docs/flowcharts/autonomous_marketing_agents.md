# Macro Architecture: Autonomous Marketing Agents & Growth Intelligence Engine

```mermaid
flowchart TD
    subgraph Layer1["Layer 1: Directive (Managerial SOPs)"]
        SOP["Campaign Goals & Budget Bounds (SOPs)"]
    end

    subgraph Layer2["Layer 2: Orchestration & Guardrails"]
        Swarm["Agent Swarm Orchestrator"]
        VisionQC["Vision QC Guardrail (Gemini 3 Pro)"]
        BrandKit["Artist Brand Kit (Colors, Vibe, Rules)"]
    end

    subgraph Layer3["Layer 3: Deterministic Execution (Write-Only)"]
        FBExec["Facebook Ads API Executor"]
        MetaGraph["Meta Graph API v19.0 (Write-Only)"]
        AuditLog["Timeline Audit Trail (Firestore)"]
    end

    subgraph Analytics["Analytics & Data Pipeline"]
        Airbyte["Airbyte Data Ingestion (Spotify/TikTok)"]
        dbt["dbt Transformation Model"]
        ClickHouse["ClickHouse Analytics (omnichannel_events & MV)"]
    end

    subgraph UI["Command Center Interface"]
        Zustand["Zustand Store Slice (AgentSwarmSlice)"]
        Dashboard["Swarm Command Center Dashboard (React + Recharts)"]
    end

    SOP --> Swarm
    Swarm --> VisionQC
    BrandKit --> VisionQC
    VisionQC -- Approved --> FBExec
    VisionQC -- Rejected --> AuditLog
    FBExec --> MetaGraph
    FBExec --> AuditLog

    Airbyte --> dbt
    dbt --> ClickHouse
    ClickHouse --> Dashboard
    AuditLog --> Zustand
    Zustand --> Dashboard
```

## Step-by-Step Transition Breakdown

1. **Layer 1 to Layer 2**: Campaign goals and budget limits flow from SOP definitions into the Agent Swarm Orchestrator.
2. **Layer 2 Internal**: Agent Swarm triggers Vision QC evaluation using Gemini 3 Pro, comparing visuals against the Artist Brand Kit.
3. **Layer 2 to Layer 3**: Approved campaigns route to Facebook Ads API Executor; rejected campaigns log audit events in Firestore.
4. **Layer 3 External**: FB Executor issues write-only Meta Graph API calls and updates timeline audit trails.
5. **Analytics Ingestion**: Airbyte pulls external metrics into dbt, transforming data for ClickHouse OLAP queries.
6. **UI Hydration**: ClickHouse performance metrics and Firestore audit logs hydrate Zustand state for the Recharts dashboard.
