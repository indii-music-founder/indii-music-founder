# Directive: Secure AI OS Architecture

**Version:** 1.0
**Date:** 2026-03-15
**Scope:** All agents — indii Conductor (Hub) and all 17+ specialist agents
**Enforced by:** Layer 2 Orchestration (You)

---

## Overview

This directive codifies the architectural patterns synthesized from OpenClaw's persistent abstractions and Antigravity's Mobile Viewport design, hardened against their documented security vulnerabilities, and implemented natively within indiiOS's 3-layer architecture.

**Core principle:** Security-by-default, not security-by-configuration.

---

## 1. Gateway Control Plane (indii Conductor as Secure Router)

indii Conductor (`agents/agent0/`) is the **single secure router** for all 17+ specialist agents.

### Responsibilities
- Accept all inbound messages via the WebSocket Control Plane (`src/services/agent/WebSocketControlPlane.ts`)
- Route to the correct specialist based on intent classification (Gemini Flash, confidence ≥ 0.7)
- Maintain per-session namespaces to isolate background jobs from the main UI thread
- Enforce command queue ordering via the WCP session lock system

### Rules
1. **No direct spoke-to-spoke communication** — all inter-agent messages route through the Hub WCP
2. **Session namespaces are immutable** — a session created with namespace `cron:X` cannot be re-assigned
3. **Locks are released explicitly** — background jobs must call `wcpInstance.releaseLock(sessionId)` on completion or error
4. **60-second ack timeout** — unacknowledged WCP messages auto-fail; do not retry silently

---

## 2. Mobile Viewport Node (Local-First Mobile Remote)

The `/mobile-remote` route (`src/modules/mobile-remote/MobileRemote.tsx`) provides a native, local-first remote control without third-party messaging.

### Pairing Protocol
1. Electron main spins up a local WebSocket server on a random port (via `electron/handlers/mobile_remote.ts`)
2. A 6-digit passcode is generated per-session (never persisted to disk)
3. The QR code encodes: `ws://<local-ip>:<port>` — the passcode is transmitted only via the QR
4. Mobile device must send `{ type: "auth", passcode: "<code>" }` as the first WS message
5. Unauthenticated connections are closed with code 4001 within 5 seconds

### Rules
- **No cloud relay** — all traffic stays on local Wi-Fi by default
- **Global access** — only via Tailscale Serve or APP_PASSWORD-protected ngrok tunnel, configured explicitly by the user
- **Passcode rotation** — new passcode generated on every Electron app launch

---

## 3. Autonomous Invocation & Session Namespace Isolation

Background jobs (Inngest, timeline campaigns, cron tasks) must use session namespaces.

### Namespace Format
```
<prefix>:<label>
```

Examples:
- `cron:album-rollout`
- `bg:legal-review`
- `inngest:waterfall-payout`

### Rules
1. **Spawn via `sessions_spawn()`** (`src/services/agent/SessionTools.ts`) — never create background sessions ad-hoc
2. **Lock immediately** — WCP lock must be acquired before any write to the session
3. **User UI thread isolation** — namespaced sessions never appear in the active `agentHistory` array
4. **JSONL event logging** — every namespaced session event is appended to the EventLogger with `namespace` metadata

---

## 4. Externalized Memory & Context Compaction

### Storage Hierarchy
| Tier       | Max Age     | Location                  |
|------------|-------------|---------------------------|
| working    | 1 hour      | In-memory ring buffer     |
| shortTerm  | 7 days      | localStorage (JSONL)      |
| longTerm   | 1 year      | Firestore + embedding index |
| archived   | Unlimited   | Firestore cold storage    |

### Rules
1. **JSONL append-only** — never mutate an existing event record; create a new one instead
2. **Compaction trigger** — working buffer compacts at 200 records to prevent memory bloat
3. **Entity extraction** — compaction must attempt proper-noun extraction for the Entity Graph
4. **No PII in logs** — event records must never contain credentials, raw auth tokens, or payment card data

---

## 5. Agent-to-Agent Coordination

All inter-agent communication uses the four Session Tools:

| Tool                | Purpose                                        |
|---------------------|------------------------------------------------|
| `sessions_list()`   | Discover active sessions (background-aware)    |
| `sessions_send()`   | Route message to a session via WCP queue       |
| `sessions_history()`| Paginated message retrieval (timestamp cursor) |
| `sessions_spawn()`  | Create isolated namespace for background work  |

### Rules
1. **sessions_send() respects locks** — if target session is locked by a different namespace, the send fails with a descriptive error (do not retry blindly)
2. **sessions_spawn() validates namespace format** — invalid formats (missing `:`) are rejected immediately
3. **Background sessions are not archived** — they are deleted (or transitioned to `isArchived: true`) upon job completion

---

## 6. Security & Sandboxing

### 6.1 Exec Approval System
All shell/filesystem/network tool calls require approval via `ExecApprovalService` (`src/services/security/ExecApprovalService.ts`).

**Approval scopes:**
- `once` — approved for this invocation only
- `session` — approved until session end / logout
- `permanent` — persisted to `exec-approvals.json` in Electron userData

**Pre-approved safe patterns (never prompt the user):**
- `npm run build`, `npm run lint`, `npm test`, `git status`, `git diff`

### 6.2 Sandboxing Requirements
- **Untrusted external inputs** (web scrape results, external DMs) must execute tools inside ephemeral Docker containers
- **High-risk categories** (`shell`, `filesystem`, `network`) with `isSandboxed: false` are blocked by policy
- **Electron sandbox** remains enabled in all production builds (`sandbox: true` in `BrowserWindow.webPreferences`)

### 6.3 Credential Policy
- **API Keys (`AIza*`)** are Firebase identifiers — safe in env vars, never in source code
- **True Secrets** (Stripe SK, service account JSON) — env vars only, never in any config file
- **Mobile Remote passcode** — memory only, never written to localStorage or Firestore

### 6.4 Model Policy (MANDATORY)
```typescript
// ALWAYS import from this path — never hardcode strings
import { AI_MODELS } from '@/core/config/ai-models';

// Complex reasoning:   AI_MODELS.TEXT_AGENT      (gemini-3.1-pro-preview, Thinking: HIGH)
// Fast routing:        AI_MODELS.TEXT_FAST        (gemini-3-flash-preview)
// Embeddings:          AI_MODELS.EMBEDDING_DEFAULT (gemini-embedding-001)
```

**BANNED models:** `gemini-1.5-*`, `gemini-2.0-*`, `gemini-pro`, `gemini-pro-vision`

---

## 7. Two-Strike Pivot Rule

If a fix fails verification **twice**:
1. STOP — do not attempt a third variation of the same approach
2. Re-diagnose with extensive logging (check ERROR_LEDGER.md first)
3. Propose a **fundamentally different solution** approach
4. Document the dead-end in ERROR_LEDGER.md before pivoting

This prevents "fix-loop" exhaustion and maintains zero-regression policy.

---

## 8. Implementation Checklist

Before marking any feature from this directive as complete, verify:

- [ ] WebSocket Control Plane connection state is observable in DevTools
- [ ] Mobile Remote QR code encodes a valid `ws://` URL with local LAN IP
- [ ] Background namespace sessions do NOT appear in `agentHistory` in the UI
- [ ] JSONL event log for a session is recoverable from localStorage after page refresh
- [ ] `sessions_send()` fails gracefully when target session is locked
- [ ] Exec approval prompt fires for any new `shell` category command
- [ ] All model references use `AI_MODELS.*` constants (grep for hardcoded `gemini-` strings)
- [ ] Passcode is NOT written to any log file or localStorage key
