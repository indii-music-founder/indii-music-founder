# 21-Agent Swarm Hierarchy & Delegation Flow

This flowchart maps the massive 21-Agent Swarm that powers the indii platform. It details the hierarchy from the `indii_executor` down to specialized domain departments, demonstrating how complex prompts are shattered into parallel sub-tasks and delegated to the precise specialist.

```mermaid
graph TD
    %% Core Orchestration
    subgraph Core ["Core Orchestration & Routing"]
        Executor["indii_executor (The Founder Agent)"]
        Generalist["generalist (Task Shatterer & Router)"]
        Conductor["conductor (Multi-Agent Sync)"]
    end

    %% Foundational & System Agents
    subgraph Foundation ["System & Alignment"]
        Foundational["foundational (Core Rules/Safety)"]
        Curriculum["indii_curriculum (Agent Training)"]
        Default["default (Fallback Node)"]
    end

    %% Legal & Administration
    subgraph Administration ["Administration & Legal"]
        Legal["legal (Contracts, IP, Clearances)"]
        Finance["finance (Budgets, Royalties, Splits)"]
        Publishing["publishing (PROs, Rights Management)"]
        Licensing["licensing (Sync, Micro-sync, Clearances)"]
    end

    %% Creative Production
    subgraph CreativeDept ["Creative Production"]
        Creative["creative (Creative Director)"]
        Music["music (A&R, Mix/Mastering, Stems)"]
        Video["video (Cinema Worldbuilder, VFX)"]
        Brand["brand (Identity, Color, Voice)"]
    end

    %% Go-To-Market
    subgraph GTM ["Go-To-Market & Operations"]
        Distribution["distribution (DSP Delivery, Metadata)"]
        Marketing["marketing (Campaigns, Ad Spend)"]
        Social["social (Content Calendar, Posting)"]
        Publicist["publicist (PR, Pitching)"]
    end

    %% Physical & Touring
    subgraph Physical ["Physical Goods & Live"]
        Merchandise["merchandise (Design, Supply Chain)"]
        Road["road (Tour Routing, Riders, Venues)"]
    end

    %% Data & Analytics
    subgraph Data ["Data Intelligence"]
        Analytics["analytics (Performance, Metrics)"]
    end

    %% Delegation Flow
    Executor -->|"1. User Intent"| Generalist
    Generalist -->|"2. Break down & delegate"| Conductor
    
    Conductor -.->|"Delegates to"| Administration
    Conductor -.->|"Delegates to"| CreativeDept
    Conductor -.->|"Delegates to"| GTM
    Conductor -.->|"Delegates to"| Physical
    Conductor -.->|"Delegates to"| Data
    
    Foundation -.->|"System constraints applied to all"| Executor

    %% Inter-Swarm Collaboration (Examples)
    Creative -->|"Requires"| Brand
    Video -->|"Clearances needed"| Legal
    Road -->|"Budgets required"| Finance
    Merchandise -->|"Needs artwork"| Creative

    %% Styling
    style Core fill:#8A2BE2,color:#FFF
    style Foundation fill:#39FF14,color:#000
    style Administration fill:#FF3333,color:#FFF
    style CreativeDept fill:#00D4FF,color:#000
    style GTM fill:#FF8C00,color:#000
    style Physical fill:#FF00FF,color:#FFF
    style Data fill:#D3D3D3,color:#000
```

## Department Breakdown & Responsibilities

1. **Core Orchestration:**
   - `indii_executor`: The absolute root of the system, acting as the user's direct proxy.
   - `generalist`: Handles intent classification. It decides if a prompt is a simple chat or a massive campaign.
   - `conductor`: The swarm synchronizer. If a task requires 5 different agents, the conductor coordinates the parallel executions and consolidates the responses.

2. **System & Alignment:**
   - `foundational`: Injects the absolute rules of the platform (safety, tone, boundaries).
   - `indii_curriculum`: The onboarding agent that learns the user's specific catalog and preferences.
   - `default`: The fallback catch-all if an intent cannot be confidently classified.

3. **Administration & Legal:**
   - `legal`: Scans for plagiarism, clears samples, generates agreements.
   - `finance`: Manages the ledger, calculates split royalties, restricts budgets.
   - `publishing`: Registers works with PROs, manages mechanicals.
   - `licensing`: Negotiates and clears sync placements (TV/Film/Games).

4. **Creative Production:**
   - `creative`: The overarching director that ensures the final product matches the `brand`.
   - `music`: Analyzes sonic signatures, handles audio processing logic.
   - `video`: Directly interacts with the Neural Cortex and generative video models.
   - `brand`: Holds the "Brand Kit" (fonts, colors, tone of voice) as gospel.

5. **Go-To-Market (GTM):**
   - `distribution`: Triggers the Proprietary Ingestion Pipeline (XML/DSR).
   - `marketing`: Builds ad campaigns and spends against the `finance` budget.
   - `social`: Drafts TikTok/IG content aligning with the `brand` voice.
   - `publicist`: Pitches DSP playlists and blogs.

6. **Physical & Live:**
   - `merchandise`: Designs physical goods and integrates with print-on-demand chains.
   - `road`: Handles tour logistics, venue booking, and artist riders.

7. **Data Intelligence:**
   - `analytics`: Reads BigQuery and DSP stats to inform the `marketing` and `road` agents.
