# Case Study — Agent Sandbox & Browser Tools

**Scope:** The sandbox / browser-execution tools the indii agents use *inside the product* (the "upper building" — renderer + Electron main + cloud). Not the DSH harness tools used to build it.
**Method:** Read-only source audit of `packages/renderer/src/services/agent/*`, `packages/main/src/*`, `execution/`, `agents/capability_registry.json`, and the related design docs. Git history consulted for the sidecar lifecycle. No code changed.
**Date:** 2026-08-23 (audit)

---

## 1. What exists — system map

### 1.1 Web-browser automation: three parallel stacks

| Stack | Brain | Body | Transport | Real state |
|---|---|---|---|---|
| **A — "Ghost Hands" bridge** | Any specialist agent calling `browser_navigate` / `browser_action` / `browser_snapshot` (`BrowserTools.ts`) or `browser_tool` (`UniversalTools.ts`) | Hidden Electron `BrowserWindow` in main (`packages/main/src/services/BrowserAgentService.ts`), `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, deny-all permission handler, per-session `persist:` partition + storage wipe on close | `electronAPI.agent.navigateAndExtract / performAction / captureState` → `ipcMain.handle` in `handlers/agent.ts` | **Half-alive.** See finding F1. |
| **B — "Gemini Drive" autonomous browser** | `BrowserAgentDriver.ts` + `BrowserAgentService.ts` (renderer) — capture→reason (UI model)→act loop, high-risk-keyword guard | Intended: Playwright in Electron main via phantom `electronAPI.browserAgent` | `electronAPI.browserAgent(...)` — **does not exist** | **Dead.** `isConfigured()` hardcoded `false` (ISSUE-972). All `MusicPortalAgents.ts` portal automations throw `Browser agent is not configured`. |
| **C — Computer Execution (CE) extension** | `ComputerTools.ts` + `ComputerAgentDriver.ts` | `ComputerExecutionService.ts` (main, provider-backed), macOS TCC preflight | `electronAPI.computer.*` → `handlers/computer.ts` | **Mostly real.** CE-1 read path shipped; CE-2 input tools ship but grant enforcement not wired (F5). |

Nine+ specialists declare `browser_tool` in `definitions/*.ts` (road, social, marketing, finance, security, legal, licensing, distribution, video, publicist, hospitality, event-planner, devops…) — all of them route into Stack A, whose production story is broken (F1).

### 1.2 Code sandbox: removed, but its ghost is everywhere

- `execute_code` (`CodeExecutionTools.ts`) — the "write arbitrary Python, runs in sandboxed sidecar" tool. Implementation is now a stub: **always returns `CODE_EXECUTION_DISABLED`** — "Python sidecar has been formally removed."
- Git: `74bca6fbb` removed the Agent Zero Python sidecar; `e7afba11b` purged legacy Agent Zero/Docker infra entirely.
- Still advertised as live: `tools/index.ts:264` help text ("Execute a Python script via the sandboxed sidecar. HIGH RISK — requires user approval") and `ToolRiskRegistry.ts:262` ("Executes arbitrary Python code via the sidecar").
- What actually remains is **not a sandbox**: `PythonBridge.ts` + `AgentSupervisor.ts` spawn `python3` against **repo-owned deterministic scripts** in `execution/` (distribution, brand, publicist handlers). Fixed script allowlist + strict path-traversal check (ISSUE-382), but no resource limits, no network egress control — it trusts the scripts, it does not sandbox model-authored code.
- `ExecApprovalService.ts` still documents "Docker/ephemeral isolation is enforced for any untrusted external input" — Docker is gone. Its sandbox-bypass guard (`isSandboxed` check) now means every high-risk shell/filesystem/network request without a sandbox flag is blocked outright: **fail-closed, but the capability it was guarding no longer exists.**

### 1.3 Cloud sandbox

- `spin_up_qa_sandbox` (`DevOpsTools.ts:361`) calls Cloud Function `provisionQASandbox` — **not deployed**. Fails with a "contact DevOps" message.

---

## 2. Governance & safety surface (what's good)

- **Risk tiers** (`ToolRiskRegistry.ts`): `read / write / destructive` + `permissionTier`. Unknown tools default to `write/plugin/requiresApproval: true` — fail-closed default.
- **DigitalHandshake** middleware: token budget, Model Armor scanning, cost intercepts, `WAITING_ON_HANDSHAKE` pause + Firestore audit.
- **CE & code-exec tiers**: `execute_code`, `computer_click/type/key/scroll/drive`, `computer_screenshot`, `computer_open_app` all `requiresApproval: true`. CE read primitives auto-approve.
- **SSRF guard** (`network-security.ts`): `validateSafeUrlAsync` blocks private/reserved/loopback IP ranges before any hidden-window navigation.
- **IPC hygiene**: `validateSender` + Zod on every handler; path-traversal checks on artifact/knowledge/file writes; sensitive-arg redaction in PythonBridge logs.
- **Renderer fail-closed contract**: `BROWSER_DESKTOP_ONLY`, `COMPUTER_DESKTOP_ONLY`, `BROWSER_BRIDGE_UNAVAILABLE` — web sessions never silently fake success.
- **Observability**: `browser_navigate` success writes `users/{uid}/browserHistory`; BaseAgent loop emits TOOL_EXECUTION events + `agent_audit` docs; `computer_drive` writes session docs with step log + screenshot hashes (never raw frames).

---

## 3. Findings (ranked)

### F1 — P0-ish: production desktop has no working browser tool
`handlers/agent.ts` registers `agent:navigate-and-extract` and `agent:perform-action` **only inside `if (!app.isPackaged)`**. `agent:capture-state` is registered in production but `BrowserAgentService` has no session started outside dev (`startSession` callers are both inside the dev block), so it throws `Session not started`. Net effect: in a shipped DMG, every `browser_tool` call fails. ISSUE-972 already documents two of the three causes in the renderer service — the third (capture-state session-less in prod) is unlabeled. Ten+ agents advertise a tool that cannot run for a packaged user.

### F2 — `execute_code` is dead but advertised as alive
Stub implementation contradicts registry classification and `tools/index.ts` help text. Agents (and users reading the tool list) are told a sandbox exists. Cost: agents waste calls on a tool that can only error; trust in tool list erodes.

### F3 — ExecApprovalService's sandbox model is historical
Docstring claims Docker/ephemeral isolation "enforced". Post-purge, no caller can supply `isSandboxed: true` for the high-risk categories, so the safety gate blocks everything high-risk. Safe, but the service is now approval theater for a nonexistent execution path — and its persisted approvals (`exec-approvals.json` + localStorage) guard commands that can never run.

### F4 — Three stacks, three stories, one broken truth
Docs disagree on the body: `docs/AUTONOMOUS_BROWSER_AGENT.md` says Puppeteer + `gemini-2.5-pro-ui-checkpoint`; `COMPUTER_EXECUTION_EXTENSION.md` §1.6 repeats "Puppeteer-based BrowserAgentService"; the main service header says "Replaces Puppeteer" (hidden Electron window); the renderer service header says Playwright. Selector-based actions (Stack A) vs coordinate-based Computer Use (Stack B) don't line up — ISSUE-972 notes the paradigm mismatch. `MusicPortalAgents.ts` (portals: DistroKid, TuneCore, ASCAP, BMI, etc.) is entirely built on the dead stack.

### F5 — CE grants are real primitives with no enforcement point
`computer:grant-session` / `revoke-grant` (CE-5, ISSUE-1114) are tested but "NOT wired into any enforcement point yet" (handlers/computer.ts:218, ISSUE-1116). Until wired, the per-session approval grant has no teeth and approval behavior relies on DigitalHandshake per-call.

### F6 — Browser write actions are under-classified
`browser_action` (click/type/scroll/wait into arbitrary pages) is tier `write`, `requiresApproval: false` — no pause before typing into a page, including credential forms. The CE analog got the no-credential-entry rule + destructive tier; the web bridge did not. `browser_tool`'s `navigate` has no renderer-side URL check (main's SSRF guard covers it — but that handler is dev-only anyway).

### F7 — Gaps in observability
`browserHistory` logging only on `browser_navigate` success; `browser_action` (types/clicks) leaves no audit row in the agent_audit trail beyond the generic tool event.

### F8 — Minor process drift
`execution/mega_browser_gauntlet.py` (dev stress harness) appends findings to `.agent/test_ledger/OPEN_ISSUES_V2.md`, which CLAUDE.md declares sealed (V3 is canonical). `docs/DESKTOP_FILE_BROWSER_TOOL.md` (ISSUE-1044) is design-phase only — file browsing from cloud agents still unavailable.

---

## 4. Assessment

**What's genuinely strong:** the governance stack. Fail-closed defaults everywhere, SSRF-aware URL validation, sandboxed hidden window primitives, Zod-on-IPC, risk registry with fail-closed unknown-tool default, approval with scopes. The architecture *pattern* (brain→bridge→body, registry, risk tiers) is sound and reusable — CE-1 proved it by shipping on the same rails.

**What's weak:** lifecycle discipline. Capabilities are removed (`execute_code` sidecar, Docker, Puppeteer→hidden window) without retiring their advertised surfaces; production gating (`!app.isPackaged`) shipped without a production path; three overlapping browser stacks split across docs that each describe a different one. The tools *look* alive from the agent's perspective and fail at runtime.

---

## 5. Recommendations (priority order)

1. **Pick one browser strategy.** Either (a) promote Stack A to production — move `navigate-and-extract`/`perform-action` out of dev-only, add a managed session lifecycle (start/close handlers + idle timeout + partition cleanup), and ship it; or (b) retire the capability: remove `browser_tool` from specialist authorizations, delete `MusicPortalAgents` dead surface, update docs. Current state (advertised + always-failing) is the worst of both. *(Owns F1, F4.)*
2. **Delete or rebuild `execute_code`.** Remove from `TOOL_REGISTRY` + help text + registry, or reimplement a real sandbox (resource-limited subprocess, no network, allowlisted FS) and re-wire `ExecApprovalService.isSandboxed` truthfully. *(F2, F3.)*
3. **One canonical doc per capability with a Status line.** Deprecate/redirect `AUTONOMOUS_BROWSER_AGENT.md`; fix the Puppeteer/Playwright/hidden-window drift. *(F4.)*
4. **Wire CE grant enforcement (ISSUE-1116) before CE-2 sees wider use**; enforce the no-credential-entry rule in main-process code, not only in the prompt. *(F5.)*
5. **Reclassify `browser_action` / typing actions** to approval-gated (or at minimum audit-log every action with selector+text hash), mirroring the CE destructive tiers. *(F6, F7.)*
6. **QA sandbox:** deploy `provisionQASandbox` or remove `spin_up_qa_sandbox` from the DevOps tool surface. *(§1.3.)*
7. **Housekeeping:** repoint the mega gauntlet at OPEN_ISSUES_V3; either ship or close ISSUE-1044. *(F8.)*

---

## 6. File map

| Concern | File |
|---|---|
| Browser tool surface (renderer) | `packages/renderer/src/services/agent/tools/BrowserTools.ts`, `UniversalTools.ts` |
| Browser body (main, hidden window) | `packages/main/src/services/BrowserAgentService.ts` |
| Browser IPC handlers (dev-only gate) | `packages/main/src/handlers/agent.ts` |
| Autonomous browser (dead, ISSUE-972) | `packages/renderer/src/services/agent/BrowserAgentService.ts`, `BrowserAgentDriver.ts`, `MusicPortalAgents.ts` |
| Computer Execution | `packages/renderer/src/services/agent/tools/ComputerTools.ts`, `ComputerAgentDriver.ts`; `packages/main/src/services/ComputerExecutionService.ts`, `handlers/computer.ts` |
| Code sandbox (stub) | `packages/renderer/src/services/agent/tools/CodeExecutionTools.ts` |
| Exec approval (sandbox model) | `packages/renderer/src/services/security/ExecApprovalService.ts` |
| Risk registry | `packages/renderer/src/services/agent/ToolRiskRegistry.ts` |
| Python subprocess bridge (deterministic scripts) | `packages/main/src/utils/python-bridge.ts`, `AgentSupervisor.ts` |
| SSRF / URL safety | `packages/main/src/utils/network-security.ts` |
| Deterministic Layer-3 scripts | `execution/**` |
| Design docs | `docs/AUTONOMOUS_BROWSER_AGENT.md`, `docs/COMPUTER_EXECUTION_EXTENSION.md`, `docs/DESKTOP_FILE_BROWSER_TOOL.md` |
| Agent capability registry | `agents/capability_registry.json` |

**Issue refs:** ISSUE-972 (browser automation broken), ISSUE-382 (script path traversal), ISSUE-1110/1111/1112 (CE-1/2/3), ISSUE-1114/1116 (CE-5 grants unwired), ISSUE-1044 (file browser design-only).
