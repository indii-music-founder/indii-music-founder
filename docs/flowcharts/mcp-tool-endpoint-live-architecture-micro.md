# MCP Tool Endpoint — Live Architecture (mcpEndpoint)

Documents the real, live-verified request flow for `mcpEndpoint` (the Cloud Function serving indii's 11 remote agent tools — split sheets, CWR, Stripe payout staging, campaign waterfall, canvas render, sample clearance, etc.), as of the 2026-07-21 live-verification session (ISSUE-1092).

**Why this exists:** the file previously exporting `mcpEndpoint` (`packages/firebase/src/mcp/index.ts`) was a stale, pre-registry relic — one hardcoded tool, no auth, a single shared `Server` instance. `mcp/registry.ts`'s `McpToolRegistry` (the real, per-session, auth-aware dispatcher) existed but was imported by zero files. This diagram reflects the rewired, actually-deployed, actually-tested architecture — not the aspirational one described in earlier session notes.

```mermaid
graph TD
    subgraph ClientLayer ["Client (Renderer / Agent Harness)"]
        Client["McpClientService.ts<br/>SSEClientTransport"]
        AuthFetch["authedFetch()<br/>injects fresh Firebase ID token<br/>on EVERY request (GET + POST)"]
    end

    subgraph Platform ["Google Cloud Platform"]
        LB["Load Balancer<br/>terminates TLS, forwards HTTP internally"]
        CF["mcpEndpoint (Gen2 / Cloud Run)<br/>maxInstances: 1 — in-memory session Map<br/>requires single-instance affinity"]
    end

    subgraph ExpressApp ["Express App (mcp/index.ts)"]
        TrustProxy["app.set('trust proxy', true)<br/>fixes req.protocol behind LB"]
        SSERoute["GET /sse"]
        VerifyToken["verifyBearerToken()<br/>admin.auth().verifyIdToken()"]
        NewSession["New Server instance<br/>+ McpToolRegistry(ALL_TOOLS)<br/>bound to McpContext{user}"]
        SessionMap["sessions: Map&lt;sessionId, {context, transport}&gt;"]
        MessageRoute["POST /message"]
        VerifyUid["defense-in-depth:<br/>token.uid === session.context.user.uid"]
    end

    subgraph Registry ["McpToolRegistry (registry.ts)"]
        ListTools["ListToolsRequestSchema<br/>→ all 11 tool names/schemas"]
        CallTool["CallToolRequestSchema<br/>→ tool.handler(args, context)"]
    end

    subgraph Tools ["11 Real Tool Handlers (mcp/tools/*)"]
        Legal["Legal: register_split_sheet,<br/>draft_cwr_registration,<br/>audit_sample_clearance"]
        Finance["Finance: calculate_recoupment,<br/>stage_stripe_payouts"]
        Creative["Creative: queue_video_render,<br/>audit_asset_resolutions"]
        Publicist["Publicist: schedule_campaign_waterfall,<br/>generate_playlist_pitch"]
        Brand["Brand: fetch_brand_kit"]
        Distro["Distribution: draft_dsp_metadata_xml"]
    end

    Client -->|"GET .../mcpEndpoint/sse"| AuthFetch
    AuthFetch --> LB
    LB --> CF
    CF --> TrustProxy
    TrustProxy --> SSERoute
    SSERoute --> VerifyToken
    VerifyToken -->|"401 if invalid"| Client
    VerifyToken -->|"valid"| NewSession
    NewSession --> SessionMap
    NewSession -.->|"messageUrl reconstructed from<br/>Host header (path prefix stripped<br/>internally, must rebuild it)"| Client

    Client -->|"POST .../mcpEndpoint/message?sessionId=..."| AuthFetch
    AuthFetch --> LB
    LB --> CF
    CF --> MessageRoute
    MessageRoute -->|"404 if unknown session"| Client
    MessageRoute --> VerifyUid
    VerifyUid -->|"403 if uid mismatch"| Client
    VerifyUid -->|"pass req.body as parsedBody<br/>(Functions v2 already consumed<br/>the raw stream)"| ListTools
    VerifyUid --> CallTool

    CallTool --> Legal
    CallTool --> Finance
    CallTool --> Creative
    CallTool --> Publicist
    CallTool --> Brand
    CallTool --> Distro

    Legal -->|"real Firestore/GCS reads+writes,<br/>honest fail-closed on error"| MessageRoute
    Finance --> MessageRoute
    Creative --> MessageRoute
    Publicist --> MessageRoute
    Brand --> MessageRoute
    Distro --> MessageRoute
    MessageRoute -->|"McpOperationResult JSON"| Client

    classDef client fill:#0F172A,stroke:#00D4FF,stroke-width:2px,color:#F8FAFC
    classDef auth fill:#1E1B4B,stroke:#FF00FF,stroke-width:2px,color:#F8FAFC
    classDef platform fill:#2E150C,stroke:#FB923C,stroke-width:2px,color:#F8FAFC
    classDef express fill:#110E2F,stroke:#6366F1,stroke-width:2px,color:#F8FAFC
    classDef registry fill:#23173C,stroke:#8B5CF6,stroke-width:2px,color:#F8FAFC
    classDef tool fill:#062F24,stroke:#10B981,stroke-width:2px,color:#F8FAFC

    class Client,AuthFetch client
    class LB,CF platform
    class TrustProxy,SSERoute,VerifyToken,NewSession,SessionMap,MessageRoute,VerifyUid express
    class ListTools,CallTool registry
    class Legal,Finance,Creative,Publicist,Brand,Distro tool
```

## Transition Breakdown

Key architectural facts, each verified live, 2026-07-21:

1. **Gen2, not Gen1.** Gen1 Cloud Functions hard-kill any HTTP response at their execution ceiling (60s default / 540s max) regardless of `timeoutSeconds` — fundamentally incompatible with SSE, which must stay open indefinitely. Confirmed live: auth succeeded, session established, then a 502 "Truncated response body" at exactly the ceiling. Gen1→Gen2 requires `firebase functions:delete <name> --region=<region>` first — `firebase deploy` refuses an in-place upgrade.
2. **`maxInstances: 1` is deliberate, not an oversight.** Sessions live in an in-process `Map`. Cloud Run doesn't guarantee session affinity across instances by default, so a `/message` POST could land on a different instance than the one holding its session and 404. Capping at one instance guarantees every request reaches the same `Map`; Node's event loop still serves many concurrent SSE connections fine on that one instance. The real long-term fix for horizontal scale is moving session state to Firestore/Redis.
3. **`trust proxy` is required**, not optional. Cloud Functions/Cloud Run terminates TLS at the load balancer and forwards internally over plain HTTP — `req.protocol` reports `'http'` for a real HTTPS caller unless Express is told to trust `X-Forwarded-Proto`.
4. **The function-name path prefix (`/mcpEndpoint`) is stripped before Express ever sees the request** — `req.originalUrl`/`req.baseUrl` cannot be used to reconstruct a client-facing callback URL. It has to be rebuilt from the `Host` header pattern instead.
5. **`req.body` must be passed through explicitly** to any library (like the MCP SDK's `SSEServerTransport.handlePostMessage`) that tries to read the raw request stream itself — Firebase Functions v2's `onRequest` already consumed it.
6. **Auth is a two-layer check:** the SSE handshake verifies the caller's ID token once to establish `McpContext`; every subsequent `/message` POST re-verifies its own bearer token and requires the same `uid` as the session — defense against a leaked/guessed `sessionId` hijacking another user's authenticated session.

See ERROR_LEDGER.md (2026-07-21, "Wiring a Cloud Functions SSE Endpoint") for the full defect-by-defect narrative, and `.agent/test_ledger/OPEN_ISSUES_V2.md` ISSUE-1092 for the commit chain.
