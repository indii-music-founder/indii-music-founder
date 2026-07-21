# Computer Execution — Extension Architecture

**Status:** Proposal (audit complete, no code written)
**Date:** 2026-07-20
**Mandate:** *Analyze the existing Execution Layer and produce an extension architecture for Computer Execution. Do not redesign the Execution Layer. Extend it.*

---

## 1. Phase 1 Audit — How the Execution Layer Works Today

The seven questions, answered from source.

### 1.1 How are tasks dispatched?

The agent reasoning loop lives in `packages/renderer/src/services/agent/BaseAgent.ts`. When the model emits a function call (~line 1140–1280), dispatch is:

1. **Loop detection** — `LoopDetector.detectLoop(name, args)` kills repetitive call patterns.
2. **Authorization** — the call is checked against the agent's declared `functionDeclarations` (or explicit `authorizedTools`). Undeclared tools are blocked with a security log (`BaseAgent.ts:1158–1177`).
3. **Schema validation** — Zod schema from `toolSchemas` parses the args.
4. **Execution** — agent-local `this.functions[name]` first, else lazy-imported global `TOOL_REGISTRY[name]` (`BaseAgent.ts:1217–1221`), with `enrichedContext` + `ToolExecutionContext` (transactional store isolation, commit/rollback).
5. **Observability** — `AgentEventBus` TOOL_EXECUTION_START/COMPLETE/FAILED events + fire-and-forget audit doc to `users/{uid}/agent_audit` with GEAP identity fingerprint (`BaseAgent.ts:1257–1271`).

Cross-agent dispatch is the A2A swarm: `consult_specialist` → `A2AClient`, which is one of only two direct `DigitalHandshake.require()` call sites.

### 1.2 How are tools registered?

- **Local tools:** flat `TOOL_REGISTRY: Record<string, AnyToolFunction>` in `packages/renderer/src/services/agent/tools/index.ts`, assembled by spreading ~70 domain modules (`BrowserTools`, `VideoTools`, `DevOpsTools`, …). Each tool is wrapped by `wrapTool()` from `utils/ToolUtils` for uniform success/error envelopes.
- **Cloud tools:** `packages/firebase/src/mcp/registry.ts` (`McpToolRegistry`) serves `IndiiMcpTool`s over the MCP endpoint. The renderer mirrors them into `TOOL_REGISTRY` via `McpTools.ts` → `createMcpWrapper()` → `mcpClientService.executeTool()`, so cloud tools look identical to local tools from the agent's perspective. **This dual registration (local module + optional cloud mirror) is the pattern any new capability must follow.**

### 1.3 How does an agent request execution?

The Gemini function-calling loop. Agents never call services directly — they emit a function call, and the BaseAgent loop routes it through authorization → validation → registry. Tool schemas are declared per-agent in `definitions/*.ts` / `agentConfig.ts` and built via `SpecialistAgentFactory`.

### 1.4 How are permissions enforced?

Two cooperating layers:

- **`ToolRiskRegistry.ts`** — single source of truth mapping every tool name to `{riskTier: read|write|destructive, permissionTier, requiresApproval}`. Unknown tools default to **high-risk plugin requiring approval** (fail closed, `getToolRiskMetadata()` fallback).
- **`governance/DigitalHandshake.ts`** — enforcement middleware. Checks compute allocation (token budget per directive), runs Model Armor input scanning, applies dynamic high-cost intercepts (e.g. `generate_video` > 15s), and pauses execution with `WAITING_ON_HANDSHAKE` directive status + Firestore audit trail when approval is needed. Read-tier tools auto-approve; destructive tools always pause.

Existing precedent for host-level risk: `execute_code` is classified `destructive / requiresApproval: true` ("runs arbitrary code on host"). **Computer input control must be classified at least as strictly.**

### 1.5 How are long-running jobs tracked?

- **Cloud:** Inngest (`packages/firebase/src/lib/inngestClient.ts`) orchestrates background jobs (campaign waterfall, Remotion renders, long-form video). Job state lives in Firestore docs (e.g. `videoJobs/{jobId}` with `status: processing|…` transitions in `lib/long_form_video.ts`). Frontend polls/subscribes to the doc.
- **Renderer:** `WorkflowStateService` / timeline services track multi-step workflow state; directives carry compute allocation and status.

### 1.6 Where does Electron plug into the pipeline?

The **Brain–Body–Bridge** pattern, already proven by the Autonomous Browser Agent (`docs/AUTONOMOUS_BROWSER_AGENT.md`):

- **Brain (renderer):** `BrowserAgentDriver.ts` — capture → reason (Gemini UI model, screenshot in prompt) → act → repeat, max-step bounded.
- **Bridge:** `packages/main/src/preload.ts` exposes namespaced `electronAPI.*` (e.g. `electronAPI.agent.navigateAndExtract/performAction/captureState`); every `ipcMain.handle` in `packages/main/src/handlers/*.ts` runs `validateSender(event)` + Zod validation (`handlers/agent.ts`).
- **Body (main process):** Puppeteer-based `BrowserAgentService` executes real browser actions.

Web sessions **fail closed**: `BrowserTools.ts` returns `BROWSER_DESKTOP_ONLY` when `window.electronAPI` is absent — no silent fallback.

### 1.7 Where does cloud execution plug in?

Three channels:

1. **Callable functions** — `httpsCallable` for synchronous cloud work.
2. **MCP endpoint** — `McpToolRegistry` for agent-invocable cloud tools (backed by Inngest for long jobs).
3. **Remote relay** — `RemoteRelayService.ts`: Firestore as message broker (`users/{uid}/remote-relay-commands/{id}` → desktop listener → `remote-relay-responses/{id}`), secured by `isOwner` rules. Paired with `StudioExecutorLeaseService.ts`: keytar-stored device enrollment + server-issued short-lived executor lease (`issueStudioExecutorLease`). **This is already a working "cloud dispatches work to the desktop runtime" channel.**

### Conclusion of audit

> **Yes — the Execution Layer can already dispatch work to the Electron runtime.** The browser capability does it today (renderer brain → IPC bridge → main-process body), and the remote relay extends the same dispatch to phone/cloud origins. Computer Execution is therefore *one new capability module and one new Electron body*, not a new subsystem.

---

## 2. Extension Points (what we reuse, untouched)

| Concern | Existing surface | Change needed |
|---|---|---|
| Tool registration | `TOOL_REGISTRY` spread in `tools/index.ts` | Add `...ComputerTools` — one line |
| Risk/permissions | `TOOL_RISK_REGISTRY` + `DigitalHandshake` | Add entries — no engine change |
| IPC bridge | `preload.ts` namespaces + `handlers/` pattern | New `electronAPI.computer.*` + `handlers/computer.ts` |
| Autonomous loop | `BrowserAgentDriver` pattern | New `ComputerAgentDriver` (same shape) |
| Model routing | `INTELLIGENCE_MODELS` config registry | Add `COMPUTER.AGENT` key (no hardcoded IDs — Anti-Pattern #9) |
| Long jobs | Firestore job docs + directive status | Reuse as-is for session tracking |
| Remote dispatch | `RemoteRelayService` + executor lease | New command type, e.g. `computer_task` |
| Audit | `agent_audit` + `AgentEventBus` | Free — inherited from BaseAgent loop |
| Web fail-closed | `BROWSER_DESKTOP_ONLY` pattern | Mirror as `COMPUTER_DESKTOP_ONLY` |

---

## 3. Proposed Capability: `Computer`

```
Execution Layer (unchanged)
├── LLM            (Genkit / Vertex)
├── Workflow       (Inngest, timelines)
├── Audio          (Essentia, FFmpeg, sidecar)
├── Video          (Remotion, Veo jobs)
├── Browser        (Puppeteer body — exists)
├── Computer       (NEW — OS-level body)
└── Native Apps    (later: thin layer over Computer via app-targeted actions)
```

### 3.1 New files

```
packages/renderer/src/services/agent/tools/ComputerTools.ts      # tool surface → TOOL_REGISTRY
packages/renderer/src/services/agent/ComputerAgentDriver.ts      # autonomous loop (mirror of BrowserAgentDriver)
packages/main/src/handlers/computer.ts                           # IPC handlers (validateSender + Zod)
packages/main/src/services/ComputerExecutionService.ts           # the Body — provider-backed executor
packages/main/src/services/computer/ComputerProvider.ts          # provider interface + implementations
packages/main/src/utils/validation.ts                            # + ComputerActionSchema (extend existing file)
```

Plus edits: `preload.ts` (new namespace), `tools/index.ts` (spread), `ToolRiskRegistry.ts` (tier entries), `INTELLIGENCE_MODELS` (brain key).

### 3.2 Tool surface (v1)

| Tool | Risk tier | Approval | Notes |
|---|---|---|---|
| `computer_screenshot` | `write` | first-use approval | Screen contents are sensitive — not `read` |
| `computer_list_apps` | `read` | auto | Running/installed apps |
| `computer_open_app` | `write` | auto after grant | App allowlist enforced in main process |
| `computer_click` / `computer_type` / `computer_key` / `computer_scroll` | `destructive` | **required (v1)** | Relax to session-scoped grant in v2 |
| `computer_drive` | `destructive` | **required** | Goal-driven autonomous loop via `ComputerAgentDriver`, max-step bounded, per-step audit |

All wrapped with `wrapTool()`; all fail closed on web with `COMPUTER_DESKTOP_ONLY`.

### 3.3 The Body — `ComputerExecutionService` (main process)

Provider interface so the executor is swappable without touching the tool surface:

```ts
interface ComputerProvider {
  capabilities(): { screenshot: boolean; input: boolean; apps: boolean };
  screenshot(display?: number): Promise<{ base64: string; width: number; height: number }>;
  click(x: number, y: number, button?: 'left'|'right'|'double'): Promise<void>;
  type(text: string): Promise<void>;
  key(combo: string): Promise<void>;
  scroll(dx: number, dy: number): Promise<void>;
  openApp(bundleIdOrPath: string): Promise<void>;
}
```

Implementations (see §4 for rationale):

- **`NativeMacProvider` (v1 target):** screenshots via Electron `desktopCapturer` (or `screencapture` CLI); input via a maintained robotjs fork (`@jitsi/robotjs`) or AppleScript/JXA + `cliclick`; app launch via `open -b`. Requires macOS TCC grants (see §5).
- **`NativeWinProvider` (v1.1):** same fork on Windows; `SendInput` under the hood.
- **`CloudBrowserProvider` (later, optional):** Browserbase/Stagehand for browser-only tasks when the desktop is offline — dispatched through the existing MCP/Inngest path, *not* through Electron.

### 3.4 The Brain — `ComputerAgentDriver`

Byte-for-byte the `BrowserAgentDriver` loop shape: navigate/capture → send screenshot + goal to the model → parse `{thought, action, params}` JSON → execute via `electronAPI.computer.*` → recapture. Differences:

- Model key `INTELLIGENCE_MODELS.COMPUTER.AGENT` — resolved from config, never a literal (Anti-Pattern #9; the browser driver already uses `INTELLIGENCE_MODELS.BROWSER.AGENT` correctly).
- Action space is coordinates, not CSS selectors.
- **Every step** re-checks a kill switch (see §5.3) before executing.

### 3.5 Long-running sessions + remote dispatch

- A `computer_drive` run creates a session doc (`users/{uid}/computerSessions/{id}`) with `status`, step log, and screenshots-hash trail — same doc-tracking pattern as `videoJobs`.
- Remote origin (phone/cloud agent) enqueues `{type: 'computer_task', goal, constraints}` through `RemoteRelayService`; the desktop picks it up only while holding a valid Studio executor lease. The handshake pause/approve flow already ships approval requests to the memory inbox — computer tasks reuse it unchanged.

---

## 4. Phase 3 — Provider Comparison

"Brain" = the model that decides actions. "Body" = the thing that moves the mouse. Most confusion in this space comes from conflating them.

| Provider | What it is | Browser | Desktop | Electron-friendly | Mac | Win | Cloud | Local | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| **Gemini 2.5 Computer Use** (Vertex/Gemini API) | Brain | ✅ (primary target) | ⚠️ partial | ✅ (API only — you supply body) | ✅ | ✅ | ✅ | ✅ | **Recommended brain.** Whole stack is already Genkit/Vertex; browser driver already runs `gemini-2.5-pro-ui-checkpoint`. One vendor, one billing path, one auth path. |
| **Anthropic Computer Use** | Brain (tool-use loop) | ✅ | ✅ (strongest desktop reasoning) | ✅ (API only) | ✅ | ✅ | ✅ | ✅ | Viable fallback brain behind the same provider interface. Adds a second vendor + API key to a Gemini shop — only if Gemini desktop quality disappoints. |
| **OpenAI Computer Use (CUA)** | Brain | ✅ | ⚠️ browser-centric | ✅ (API only) | ✅ | ✅ | ✅ | ✅ | Same trade as Anthropic, less desktop-focused. Pass for v1. |
| **Browserbase** | Cloud browser infra (body, hosted) | ✅ | ❌ | n/a (runs remotely) | n/a | n/a | ✅ | ❌ | Good for a *future* cloud-browser execution target via MCP/Inngest. Not computer use. |
| **Stagehand** | Browser SDK (Playwright + AI fallback) | ✅ | ❌ | ⚠️ (would replace Puppeteer body) | ✅ | ✅ | ✅ | ✅ | Candidate to *upgrade the existing Browser capability* someday. Out of scope for Computer. |
| **LangChain** | Orchestration framework | ❌ | ❌ | ❌ | – | – | – | – | **Not a provider.** It's the layer indii already built (Conductor, A2A, TOOL_REGISTRY, DigitalHandshake). Adopting it = redesigning the Execution Layer, which this document forbids. Rejected. |
| **@jitsi/robotjs** (robotjs fork) | Local input body (native module) | – | ✅ | ✅ (main process) | ✅ | ✅ | ❌ | ✅ | **Recommended v1 input body.** Maintained fork; nut.js discontinued public maintenance/commercialized, original robotjs unmaintained. |
| **AppleScript/JXA + cliclick** | Local mac body (no native deps) | – | ✅ mac only | ✅ (child_process) | ✅ | ❌ | ❌ | ✅ | Zero-native-module fallback if robotjs binary packaging fights Electron Forge. Also the path to app-targeted "Native Apps" actions later. |

**Bottom line:** Brain = Gemini Computer Use via Vertex (config-keyed, swappable). Body = local main-process provider (`@jitsi/robotjs` first, AppleScript fallback). Nothing external orchestrates — indii's own Execution Layer stays the orchestrator.

---

## 5. Security & Permissions (non-negotiable)

1. **OS permission preflight.** macOS requires Screen Recording (screenshots) + Accessibility (input) TCC grants. Add `computer_check_permissions` (read tier) using `systemPreferences.isTrustedAccessibilityClient()` + a capture probe; drivers must preflight and return actionable guidance instead of failing mid-run.
2. **Risk classification.** Input tools enter `TOOL_RISK_REGISTRY` as `destructive / requiresApproval: true` — same class as `execute_code`. The unknown-tool default already fails closed if an entry is forgotten, but forgetting one is still a defect.
3. **Kill switch.** Global hotkey + UI stop button set an abort flag in the main process; `ComputerExecutionService` checks it before every action. The user must always be able to reclaim the machine instantly (mouse-shake abort like other computer-use harnesses is a v2 nicety).
4. **App allowlist in the main process,** not the renderer — renderer is untrusted for policy (matches existing `validateSender` + Zod posture in `handlers/`).
5. **No credential entry.** The driver's system prompt must forbid typing into password/payment fields; the main process additionally refuses `type` into secure-input contexts where detectable (macOS `SecureInput` flag).
6. **Audit.** Free via BaseAgent (`agent_audit` + GEAP fingerprints); session doc adds per-step action log. Screenshots are sensitive — store hashes/metadata in the session doc, not raw frames.
7. **Remote tasks require a live executor lease** (existing `issueStudioExecutorLease` flow) and land in the handshake queue — a phone-originated computer task is never auto-approved in v1.

---

## 6. Delivery Plan (vertical slices)

| Phase | Slice | Proof |
|---|---|---|
| **CE-1** | Bridge + read path: `handlers/computer.ts`, preload namespace, `ComputerExecutionService` with screenshot + list/open app, permission preflight tool, risk entries, `COMPUTER_DESKTOP_ONLY` fail-close | Agent takes a screenshot in desktop app; web build returns clean error; `npm run typecheck && npm test -- --run` green |
| **CE-2** | Input body: click/type/key/scroll via provider, kill switch, app allowlist, handshake-gated | Approved single actions work; unapproved actions pause with `WAITING_ON_HANDSHAKE` |
| **CE-3** | Brain: `ComputerAgentDriver` + `INTELLIGENCE_MODELS.COMPUTER.AGENT` + `computer_drive` tool + session doc | Goal-driven task completes with per-step audit trail |
| **CE-4** | Remote dispatch: `computer_task` relay command type, lease-gated, inbox approval | Phone queues a task; desktop executes after approval |
| **CE-5** | Hardening: Windows provider, secure-input refusal, session-scoped grants, screenshot redaction | Platinum pass (`/plat`) |

Each phase is independently shippable and touches zero existing execution machinery beyond one-line registrations.

---

## 7. Non-Goals

- **No Execution Layer redesign.** No new orchestrator, no LangChain, no parallel tool registry.
- **No cloud VM computer use in v1.** The desktop *is* the computer; cloud-hosted VMs are a separate product decision.
- **No music generation** (standing hard rule — irrelevant here but stated for completeness).
- **No selector-based native-app scripting framework yet.** "Native Apps" as a distinct capability arrives only after Computer proves the coordinate-based path.
