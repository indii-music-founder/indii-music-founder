# Technical Micro Flowchart: Autonomous Marketing Agents Execution & State Loop

```mermaid
flowchart TD
    classDef stateNode fill:#0d1117,stroke:#3b82f6,stroke-width:2px,color:#fff
    classDef qcNode fill:#0d1117,stroke:#eab308,stroke-width:2px,color:#fff
    classDef execNode fill:#0d1117,stroke:#10b981,stroke-width:2px,color:#fff
    classDef errNode fill:#0d1117,stroke:#ef4444,stroke-width:2px,color:#fff

    subgraph SwarmState["Zustand State Loop (createAgentSwarmSlice)"]
        UIAction["User / Agent triggers toggleSwarmStatus(true)"]:::stateNode
        FetchMetrics["fetchCampaignMetrics() -> daily_ad_performance_mv"]:::stateNode
        FetchLogs["fetchAgentLogs() -> timelineExecutionLogs"]:::stateNode
    end

    subgraph VisionPipeline["Vision QC Guardrail (VisionQC.ts)"]
        CreativeInput["Input Base64 Creative Asset + BrandKit"]:::qcNode
        GeminiCall["GoogleGenAI generateContent (gemini-3.1-pro-preview)"]:::qcNode
        JSONParse["Parse JSON { approved, reason }"]:::qcNode
        Decision{"Approved?"}:::qcNode
    end

    subgraph ExecutionPipeline["Write-Only Execution (facebookAdsExecutor.ts)"]
        FetchToken["Fetch Meta Token from Firestore users/{uid}/analyticsTokens/meta"]:::execNode
        UploadImage["POST /act_{adAccountId}/adimages (returns imageHash)"]:::execNode
        CreateCreative["POST /act_{adAccountId}/adcreatives"]:::execNode
        AuditLogSuccess["Firestore timelineExecutionLogs.add({ status: 'success' })"]:::execNode
        AuditLogFailure["Firestore timelineExecutionLogs.add({ status: 'failed' })"]:::errNode
    end

    UIAction --> FetchMetrics
    UIAction --> FetchLogs
    CreativeInput --> GeminiCall
    GeminiCall --> JSONParse
    JSONParse --> Decision
    Decision -- Yes --> FetchToken
    Decision -- No --> AuditLogFailure
    FetchToken --> UploadImage
    UploadImage --> CreateCreative
    CreateCreative --> AuditLogSuccess
```

## State Transitions & Data Flow Detail

1. **State Initialization:** `AgentSwarmSlice` initializes `isSwarmActive: true`. The `AgentSwarmDashboard` triggers `fetchAgentLogs()` and `fetchCampaignMetrics()` on mount to hydrate state via Zustand shallow selectors.
2. **Quality Control Evaluation:** Base64 ad visual payloads pass through `runCreativeVisionCheck()`. Gemini 3 Pro evaluates visual traits against the artist's `BrandKit` (colors, vibe, forbidden elements) and returns a structured decision.
3. **Deterministic Execution:** Approved creatives trigger `pushAdCreative()`. The function fetches the user's encrypted Meta access token, posts the asset to `/adimages`, creates the concept via `/adcreatives`, and logs an immutable audit trail entry into Firestore `timelineExecutionLogs`.
