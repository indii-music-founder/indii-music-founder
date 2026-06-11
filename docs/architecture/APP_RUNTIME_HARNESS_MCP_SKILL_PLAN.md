# A+ Runtime Harness, MCP, And Product Skill Plan

> **Status of this document:** Re-baselined against the actual codebase on
> 2026-05-28. The "Verified Implementation Context", "Dependencies & Sequencing",
> and "Process Boundary" sections below are load-bearing — read them before acting
> on any later section. This plan is **downstream of**
> `BUSINESS_HARNESS_FULL_SUCCESS_PLAN.md`: the runtime tools and MCP server here
> cannot be built until that plan's Wave 1 rails (`HarnessCompiler`,
> `HarnessRegistry`, `compileHarness()`) exist.

## Summary

Make every shipped indii.music app agent harness-aware at runtime. This is product architecture for the shipped indii.music application, not developer-agent workflow infrastructure.

The shipped app needs three runtime layers:

- **Harness layer:** deterministic compilers that produce `HarnessRun` state.
- **Product skill layer:** app-bundled `SKILL.md` playbooks that teach runtime agents how to use harness state.
- **MCP/tool layer:** app-facing tools and MCP resources that let agents list, compile, read, brief, and route harnesses safely.

No product runtime agent should depend on `.agent/*`, WIIL commands, or developer workflow docs. (Note: the existing MCP server `indii-local-mcp` is exactly such developer infrastructure — GitHub/Sentry/ffprobe — and must stay separate from the product MCP server defined here.)

## Verified Implementation Context

Every proposal below anchors to what already exists. Confirmed on 2026-05-28.

- **Harness core lives in the renderer.** `BUSINESS_HARNESS_CATALOG`, `HarnessDomain`, `HarnessRun`, `HarnessInputRef`, `createHarnessRun` are in `packages/renderer/src/services/business-harness/`. The generic `HarnessCompiler`/`HarnessRegistry`/`compileHarness()` rails **do not exist yet** (see Dependencies).
- **Agent cards are dual-source:**
  - JSON: `agents/<id>/agent_card.json` — `schemaVersion: '1.0.0'`, `agentId`, `displayName`, `description`, `capabilities`, `inputSchemas`, `outputSchemas`, `costModel`, `riskTier`, `sla`.
  - TS (canonical schema): `packages/renderer/src/services/agent/a2a/AgentCard.schema.ts` (zod `AgentCardSchema`) + `AgentCard.ts` + `cards/*.card.ts`. **Only some** agents have TS cards. The schema already demonstrates the optional-extension pattern via `roster: RosterSchema.optional()` — harness metadata should be added the same way.
- **Tool registry pattern:** `packages/renderer/src/services/agent/tools/index.ts` exports `TOOL_REGISTRY: Record<string, AnyToolFunction>` built from `...XTools` objects. Tools use `wrapTool(name, fn)` + `toolError`/`toolSuccess` from `../utils/ToolUtils`, and read `userId` from `auth.currentUser?.uid` — never from model input. New harness tools register here as a `HarnessTools` module.
- **Harness tools already exist:** `tools/ReleaseHarnessTools.ts` exposes `compile_release_harness` (auth-gated, returns `toolError` when unauthenticated); `tools/CreatorProtectionTools.ts` exists. These are the wrappers to fold into the generic layer.
- **MCP today:** `packages/mcp-server-local/src/index.ts` = `indii-local-mcp` (dev tools, stdio). Product MCP **client** = `packages/main/src/services/mcp/MCPClientService.ts` (Electron main). Additional MCP entry at `packages/firebase/src/mcp/index.ts`.
- **Dataset validator:** `packages/renderer/src/test/harness-datasets.test.ts` validates JSONL schema (dual: legacy `agent_id`/`scenario_id` vs new `acceptance_notes`/`context`/`expected`); it does **not** enforce counts.

## Dependencies & Sequencing

This plan does not stand alone.

1. **Wave 1 of `BUSINESS_HARNESS_FULL_SUCCESS_PLAN.md`** (`HarnessCompiler` interface, `HarnessRegistry`, `compileHarness(domain, input, ctx)`, `schemaVersion` on `HarnessRun`, Release→`HarnessRun` adapter). The generic `compile_harness`, `get_harness_run`, `list_harness_runs`, and Boardroom tools here are thin wrappers over those rails and **cannot be built first**.
2. **Harness-core extraction to a shared package** (see Process Boundary) — required before any node-side MCP server can compile harnesses.
3. **`HarnessTools` (renderer)** — register generic harness tools in `TOOL_REGISTRY`, wrapping existing `ReleaseHarnessTools`/`CreatorProtectionTools`.
4. **`indii-harness` MCP server** — exposes the shared harness core to MCP clients.
5. **Product skills + agent-card harness metadata** — wire skills/manifests and card extensions.
6. **Dataset count CI** — independent of the rails; can land any time.

## Process Boundary & Code Location

The single biggest architectural gap in the original plan: **harness compilers run
in the renderer, MCP servers run in node/main.** An MCP server cannot import
renderer code.

- **Recommended:** move the harness core (types, `HarnessRegistry`, compilers, catalog) into `packages/shared` so both the renderer (`TOOL_REGISTRY`) and a node-side `indii-harness` MCP server import one deterministic implementation. Firestore access is abstracted behind an injected storage adapter (renderer uses the web SDK; node uses admin/REST).
- **Rejected alternative:** have MCP tools proxy into the running app via IPC/HTTP. Lower determinism, harder to test, couples MCP availability to a live renderer. Document only if shared extraction proves infeasible.

## Runtime Architecture

### Product Skills

Create app-facing skill files under `agents/*`, separate from developer workflow skills. **Align with the existing convention:** skills already live at `agents/conductor/skills/<name>/SKILL.md`, and per-agent python tools at `agents/<id>/skills/tools/`. There is **no `agents/shared/` directory today** — either host the shared harness skill under `agents/conductor/skills/business_harness_system/` (conductor is the orchestrator/shared brain) or create `agents/shared/` deliberately and document why.

Canonical structure (using the conductor-as-shared option):

- `agents/conductor/skills/business_harness_system/SKILL.md`
- `agents/conductor/skills/business_harness_system/skill_manifest.json`
- `agents/conductor/skills/business_harness_system/harness_domain_map.json`
- `agents/<agentId>/skills/business_harness/SKILL.md`

`SKILL.md` stays canonical. `skill.markdown` can be supported as a compatibility alias, but new product skills should use `SKILL.md`.

Shared skill rules:

- Read relevant harness runs before answering.
- Compile a harness when no current run exists.
- Cite harness run IDs, blockers, confidence, assumptions, and approval gates.
- Route cross-domain conflicts to Boardroom.
- Draft only when an action requires approval.
- Never invent readiness, legal protection, distribution status, royalty status, or cost data.

### Product Skill Manifest

Use a manifest so packaged Electron can load product skills without arbitrary filesystem access.

Minimum shape:

```ts
interface ProductSkillManifest {
  schemaVersion: '1.0.0';
  skillId: string;
  displayName: string;
  canonicalFile: 'SKILL.md';
  supportedAliases: ['skill.markdown'];
  appliesToAgents: string[];
  ownedHarnessDomains: HarnessDomain[];
  supportingHarnessDomains: HarnessDomain[];
  toolRefs: string[];
  mcpServers: string[];
  riskRules: string[];
}
```

Runtime loading:

- Generate a product skill registry at build time (distinct from the auto-generated `agents/capability_registry.json`, which indexes agent folders, not harness skills).
- Bundle markdown through Vite raw imports or static app assets.
- Inject compact skill text into agent prompts through the app context pipeline.
- Do not inject the full architecture plan into every prompt.

## Agent-Harness Matrix

**This matrix must be derived from `BUSINESS_HARNESS_CATALOG` (HarnessCatalog.ts), not hand-maintained here.** Today the markdown below diverges from the catalog (the catalog has narrower support lists). Resolve by making the catalog the single source of truth, generating this table from it, and adding a test that fails on drift. The richer support lists below are the **target** the catalog should adopt; until the catalog is updated, the catalog wins at runtime.

| Harness | Owner | Support (target) |
|---|---|---|
| Artist Memory / Operating Model | `keeper` | `creative`, `finance`, `legal` |
| Song DNA / Creative Intake | `music` | `marketing`, `legal`, `distribution`, `licensing` |
| Creator Protection | `legal` | `security`, `distribution`, `publishing` |
| Distribution / DDEX | `distribution` | `legal`, `publishing`, `security` |
| Release | `distribution` | `marketing`, `creative`, `finance`, `legal` |
| Finance | `finance` | `finance.accounting`, `finance.tax`, `finance.royalty` |
| Activity / Time Value | `finance` | `keeper` |
| Road / Travel | `road` | `finance`, `legal`, `security` |
| Gear / Asset | `finance` | `music`, `road` |
| Merch / POD | `merchandise` | `finance`, `legal`, `brand`, `marketing` |
| Marketing / Growth | `marketing` | `social`, `publicist`, `brand`, `finance` |
| Fan / CRM | `marketing` | `social`, `merchandise`, `road`, `analytics` |
| Publishing / Rights | `publishing` | `legal`, `finance.royalty`, `distribution` |
| Collaboration / Splits | `legal` | `publishing`, `finance`, `music` |
| Licensing / Sync | `licensing` | `legal`, `publishing`, `music` |
| Royalty / Revenue | `finance.royalty` | `finance`, `publishing`, `distribution` |
| Legal / Compliance | `legal` | `legal.contracts`, `legal.compliance`, `security` |
| Creative Production | `creative` | `producer`, `director`, `video`, `music` |
| Opportunity | `generalist` | `finance`, `legal`, `marketing`, `road` |
| Education / Curriculum | `curriculum` | `keeper`, `generalist` |
| Security / Trust | `security` | `legal`, `devops`, `distribution` |
| Boardroom Meta-Harness | `generalist` / Conductor | all owners |

Royalty runtime references should point to finance-owned services (`finance/RoyaltyService.ts`, `finance/WaterfallEngine.ts`, `finance/RoyaltyPayoutService.ts`) unless specifically discussing publishing mechanical royalty workflows.

## Agent Existence Reconciliation

"Every harness domain maps to a product runtime agent" **fails today.** Missing `agents/<id>` folders for matrix/catalog IDs:

- `keeper` — owner of Artist Memory. No product agent.
- `security` — owner of Security/Trust. No product agent (only `services/security`).
- `curriculum` — owner of Education. Folder is named `indii_curriculum` (naming mismatch).
- `producer`, `director` — referenced as support; exist only as TS cards (`a2a/cards/producer.card.ts`, `director.card.ts`), no folder.
- `devops` — referenced as Security support; no product agent.

Required before the registry acceptance can pass: create these product agents (folder + `agent_card.json` + skill ref) or remap ownership to an existing agent, and reconcile the dual JSON/TS card sources so each agent has one authoritative card.

## Agent Card Extensions

Extend agent cards with harness metadata by adding an **optional** field to the canonical `AgentCardSchema` (zod), mirroring the existing `roster: RosterSchema.optional()` precedent, and adding the same field to the JSON cards (`agents/<id>/agent_card.json`):

```ts
interface HarnessAwareAgentCardExtension {
  ownedHarnessDomains: HarnessDomain[];
  supportingHarnessDomains: HarnessDomain[];
  skillRefs: string[];
  mcpServers: string[];
  approvalAuthority: 'none' | 'draft' | 'user_required' | 'attorney_required';
  blockedActions: string[];
}
// AgentCardSchema gains:  harness: HarnessCardSchema.optional()
```

Registry acceptance:

- Every harness domain has exactly one primary owner.
- Every domain maps to product runtime agents (gated on Agent Existence Reconciliation).
- Every harness-owning agent has a product skill ref.
- Boardroom can seat agents from the registry.

## Risk Vocabulary (Unify)

Three risk enums exist today and must be reconciled into one canonical mapping; otherwise "MCP never bypasses approval gates" is unenforceable:

| Layer | Field | Values today |
|---|---|---|
| Agent card | `AgentCardSchema.riskTier` | `read` · `write` · `destructive` |
| Harness gate | `HarnessApprovalGate.riskTier` | `approval` · `blocked` · `attorney_review` · `destructive` |
| MCP tool (this doc) | tool tier | `read` · `draft_write` · `approval_required` · `blocked_without_user_approval` |
| Card extension (this doc) | `approvalAuthority` | `none` · `draft` · `user_required` · `attorney_required` |

Define one canonical risk ladder and a mapping table so a tool's MCP tier, the gate it must emit, and the card's authority are derivable from each other. No tool may resolve to a tier weaker than the gate its action requires.

## Runtime Harness Tools

Add generic app tools (register in `TOOL_REGISTRY` via a `HarnessTools` module using `wrapTool` + auth-derived `userId`):

- `list_harness_catalog`
- `compile_harness`
- `get_harness_run`
- `list_harness_runs`
- `get_harness_context_for_agent`
- `create_boardroom_decision`
- `explain_approval_gates`
- `create_harness_agent_brief`

`compile_harness` contract:

```ts
interface CompileHarnessInput {
  domain: HarnessDomain;
  projectId?: string;
  releaseId?: string;
  trackId?: string;
  sourceRunIds?: string[];
  inputRefs?: HarnessInputRef[];
  requestedAction?: string;
  payload?: Record<string, unknown>;
  save?: boolean;
}

interface CompileHarnessOutput {
  run: HarnessRun;
  savedRunId?: string;
  ownerAgentId: string;
  supportingAgentIds: string[];
  approvalRequired: boolean;
  blockedActions: string[];
  boardroomRecommended: boolean;
}
```

Rules:

- `userId` comes from authenticated app state (`auth.currentUser`), never model input — matching the existing `ReleaseHarnessTools` pattern.
- `domain` must exist in `BUSINESS_HARNESS_CATALOG`.
- `compile_harness` delegates to `compileHarness(domain, input, ctx)` from the shared registry (dependency #1). It does not reimplement domain logic.
- `save: false` returns draft-only output. `save: true` persists harness state only.
- External execution stays blocked behind approval.

Existing `ReleaseHarnessTools` (`compile_release_harness`) and `CreatorProtectionTools` remain, and become thin wrappers over the generic harness layer once it exists.

## MCP Plan

Add an app-facing MCP server named `indii-harness`, **separate from the developer `indii-local-mcp` server**. It imports the shared harness core (Process Boundary) and is consumed by the existing `packages/main/src/services/mcp/MCPClientService.ts`. Specify its package home (e.g. `packages/mcp-server-harness`), transport (stdio for Electron-spawned, consistent with `indii-local-mcp`), and Firestore access via the injected storage adapter.

MCP tools:

- `list_harness_catalog`
- `compile_harness`
- `get_harness_run`
- `list_harness_runs`
- `get_agent_harness_skill`
- `get_agent_harness_brief`
- `create_boardroom_decision`
- `explain_approval_gates`

Risk tiers (mapped per the Risk Vocabulary table):

- `read`: catalog, run, skill reads
- `draft_write`: draft harness compilation
- `approval_required`: persisted packets, prepared notices, prepared orders
- `blocked_without_user_approval`: delivery, paid ads, POD orders, legal notices, filings, contracts, biometric monitoring

MCP must never bypass app approval gates. Because the MCP server runs outside the renderer, the user-approval handshake for `approval_required`/`blocked_without_user_approval` actions must round-trip through the app, not be self-certified by the MCP process.

## Dataset Count Rules

Fix the current dataset validation gap.

Current state:

- `harness-datasets.test.ts` validates JSONL parse/schema shape (dual schema: legacy `agent_id`/`scenario_id` and new `acceptance_notes`/`context`/`expected`).
- It does not enforce minimum target counts.

Add count enforcement (keying off the **new** schema only, since legacy records lack `expected.primary_agent`/`context.harness_runs`):

- Count records by `expected.primary_agent`.
- Count records by harness domain in `context.harness_runs[*].domain`.
- Count cross-domain records by `expected.supporting_agents`.
- Enforce 25 gold examples per primary harness owner.
- Enforce 10 cross-domain examples per supporting agent/domain pair.
- Preserve the existing 100-example-per-agent target where the agent training plan marks that agent as active.
- Report exact deficits instead of a generic failure.

## Test Plan

Unit tests:

- Product skill registry loads shared and per-agent skill manifests.
- Agent-harness matrix/manifest matches `BUSINESS_HARNESS_CATALOG` (drift test).
- Agent card harness metadata validates against the extended `AgentCardSchema`.
- `compile_harness` rejects unknown domains and unauthenticated calls.
- `get_harness_context_for_agent` returns bounded relevant context.
- Risk-vocabulary mapping resolves consistently across card/gate/MCP tiers.
- Dataset validator enforces count targets, not only JSONL shape.

Integration tests:

- Agent context includes relevant harness runs, blockers, and approval gates.
- Boardroom seats agents from harness ownership.
- MCP server lists harness tools and rejects unknown tools.
- MCP draft tools cannot trigger external side effects.
- MCP `approval_required` actions round-trip user approval through the app.
- Packaged app loads product skills without `.agent/*` references.

Cleanup:

- Rename or split misleading `BusinessHarnessService.test.ts` because there is no matching `BusinessHarnessService.ts`.
- Reconcile dual agent-card sources (JSON + TS).

## CI & Acceptance (Measurable)

- Matrix-vs-catalog drift test is green.
- Card-schema validation covers every product agent's `agent_card.json`.
- Dataset count test reports per-owner / per-supporter deficits and gates CI.
- `indii-harness` MCP server type-checks against the shared harness core (proves the Process Boundary extraction).
- No harness tool resolves to a risk tier weaker than the gate its action requires.

## Acceptance Scenarios

- Uploading a song gives Music, Legal, Distribution, Publishing, Release, Security, and Boardroom the same harness packet.
- Finance uses finance-owned royalty services plus time, mileage, gear, hidden cost, and legal protection cost lines.
- Marketing drafts paid ads but cannot launch without Finance, Legal, and Boardroom gates.
- Legal drafts an AI voice clone takedown packet but cannot send it without approval.
- Boardroom cites source harness run IDs and refuses to invent missing facts.

## Non-Goals

- Building the harness rails themselves (that is `BUSINESS_HARNESS_FULL_SUCCESS_PLAN.md` Wave 1).
- Extending or replacing the developer `indii-local-mcp` server.
- Auto-creating missing product agents without an ownership decision (see Agent Existence Reconciliation).

## Risks

- **Hidden dependency:** building harness tools/MCP before the registry rails exist produces stubs that drift. Enforce the sequencing.
- **Process boundary:** if the harness core is not extracted to a shared package, the MCP server either duplicates logic (drift) or couples to a live renderer (fragile).
- **Vocabulary drift:** three risk enums silently disagree; an action could be exposed at a weaker tier than its gate. The mapping table + the "no weaker tier" CI check mitigate this.
- **Matrix drift:** a hand-maintained matrix re-diverges from the catalog. Derive it and test it.

## Assumptions

- Product runtime work lives under `agents/*`, renderer agent services, a shared harness-core package, MCP packages, product tools, and app agent cards.
- Developer workflow infrastructure (`indii-local-mcp`, `.agent/*`, WIIL) remains separate.
- `SKILL.md` is canonical for product skills.
- No app agent, MCP tool, or harness compiler can spend money, distribute music, send legal notices, file registrations, sign or send contracts, order POD, publish publicly, or enable biometric monitoring without explicit user approval.
