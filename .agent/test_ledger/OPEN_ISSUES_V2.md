# Open Issues V2 — Real-Life Test Findings

> This file is written by the /real test agent and consumed by a fixing agent.
> The test agent NEVER modifies code. The fix agent NEVER runs tests.
>
> **Last updated:** 2026-07-17
> **Branch:** `main`
>
> **Note:** This is V2 of the Open Issues ledger. The original (1.7MB+) is preserved at `OPEN_ISSUES.md`.

## Active Pipeline: MCP Swarm Expansion (A2A Harness)

### Completed 🟢
1. **Architectural Scaling Decision:** Migrated from a proxy callable to direct SSE connections validated via Firebase Auth JWTs. This decentralized approach (Option B) allows infinite horizontal scaling (1M-10M+ users) by removing the middleman Cloud Function bottleneck.
2. **Backend Authentication:** Updated `packages/firebase/src/mcp/index.ts` to decode and verify `Bearer <JWT>` tokens.
3. **Frontend Harness (SSE Client):** Built `McpClientService.ts` to establish persistent, secure SSE connections from the React desktop/web app directly to the Cloud Run backend.
4. **Tool Wrapper Bridge:** Created `McpTools.ts` which encapsulates the 10 remote tools into standard Agent Harness definitions (complete with schemas and risk definitions).
5. **Swarm Integration:** Equipped the existing agent definitions with their new tools:
   - `DistributionAgent`: `draft_dsp_metadata`
   - `FinanceAgent`: `calculate_recoupment`, `stage_stripe_payouts`
   - `BrandAgent`: `fetch_brand_kit`
   - `PublicistAgent`: `schedule_campaign_waterfall`, `generate_playlist_pitch`
   - `CreativeAgent`: `queue_remotion_render`, `audit_asset_resolutions`
   - `LegalAgent`: `generate_split_sheet`, `analyze_contract_risk`

### Pending Actions & Testing 🟠
1. **[E2E/UI Testing] Test A2A Routing:** We need to verify that an agent in the UI (e.g., the Publicist Agent) can successfully trigger its newly mapped tool and return the `"MOCK_DATA_FROM_MCP_SERVER"` string.
2. **[Backend Logic] Stub Implementation:** We must replace the hardcoded "mock" responses in `packages/firebase/src/mcp/tools/*.ts` with the actual production logic (e.g., triggering Remotion renders, generating Stripe payouts).
3. **[Swarm Workflow] Boardroom Validation:** Ensure agents can collaborate and pass the outputs of these new tools to one another within a boardroom session.
