# Engine A/B/C/D Coordination

This repo already has the slash command slots for the internal testing/build/CI/CD engine system:

- Engine A: `.agent/workflows/a.md` (`/a`)
- Engine B: `.agent/workflows/b.md` (`/b`)
- Engine C: `.agent/workflows/c.md` (`/c`)
- Engine D: `.agent/workflows/d.md` (`/d`)
- Full launch: `.agent/workflows/abcd.md` (`/abcd`)

## Current Alignment

| Engine | Current Role | Good Fit | Main Gap Closed Here |
| --- | --- | --- | --- |
| A | Finder | Runs real tests, live browser checks, and writes issues | Now explicitly named Engine A and tied into `/abcd` |
| B | Fixer | Claims ledger issues, fixes code, commits | Now explicitly framed as one lane in ABCD, not generic supervision |
| C | Shipper | Keeps branch/main CI green and watches deployment path | Now separated from B and D so CI is not treated as self-verification |
| D | Verifier | Audits fixed claims and re-opens fake/incomplete fixes | Now checks B and C claims as the quality gate |

The closest current prototype for multi-agent discovery is the `.agents/teamwork_preview_*` set:

- `.agents/teamwork_preview_orchestrator_remote_connection/`
- `.agents/teamwork_preview_explorer_remote_connection_1/`
- `.agents/teamwork_preview_explorer_remote_connection_2/`
- `.agents/teamwork_preview_explorer_remote_connection_3/`
- `.agents/teamwork_preview_sentinel/`

That prototype maps naturally to the ABCD system:

| Prototype Shape | Engine Equivalent |
| --- | --- |
| Orchestrator | Engine C for coordination, or `/abcd` when launching the whole loop |
| Explorer agents | Engine A when they are finding issues only |
| Worker | Engine B when it is implementing fixes |
| Sentinel | Engine D when it is independently verifying claims |

## Source Of Truth

For cross-app operation, do not depend on a single agent's chat memory. Codex, Claude, Gemini, and any other AI app must discover state from these repo files:

- `.agent/workflows/abcd.md` for the full launch sequence.
- `.agent/workflows/a.md` through `.agent/workflows/d.md` for each engine lane.
- `.agent/test_ledger/OPEN_ISSUES.md` for work claims, fixes, verification notes, and re-opens.
- Git commits and GitHub Actions runs for CI/CD evidence.
- `.agents/teamwork_preview_*` folders only as active prototype artifacts owned by whichever agent created them.

## Launch Modes

### `/a`

Starts Engine A only. Use when you want more real findings and no code edits.

### `/b`

Starts Engine B only. Use when the ledger already has open issues and you want one fixed issue per loop.

### `/c`

Starts Engine C only. Use when branch/main CI, release flow, or deployment health needs active supervision.

### `/d`

Starts Engine D only. Use when you want an independent no-code audit of `FIXED` or shipped claims.

### `/abcd`

Starts the full workflow. Default order is A, B, C, D. If the user asks for A, then B, then D, run those first and let C join later. D must report CI/deploy gaps as unverified if C has not produced evidence.

## Concurrency Rules

1. Pull/rebase before reading or writing the ledger.
2. Claim exactly one issue before editing code.
3. Commit ledger status changes immediately.
4. Never rewrite another engine's verification notes.
5. Never mark fake data, skipped assertions, loosened tests, or mock-heavy behavior as fixed.
6. If an engine cannot prove a claim from source, tests, browser output, or CI logs, it must leave the claim open or blocked.

## Relationship To Runtime A2A

The app's A2A system under `packages/renderer/src/services/agent/a2a/` is for in-app specialist agents. It publishes agent cards, routes encrypted JSON-RPC calls, and enforces hub/spoke rules inside the product.

Engine A/B/C/D is different. It is a repo-level engineering coordination protocol for external AI apps working on tests, fixes, CI, and verification. The two systems can share principles, but Engine A/B/C/D must stay file-backed so multiple AI tools can coordinate without sharing runtime memory.
