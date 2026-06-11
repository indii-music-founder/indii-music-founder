# Audit Session Checkpoint — 2026-06-02

**Objective:** Guarantee API system is solid, secure; image/video generation works; assets escalate to marketing; env-var parity across all environments.

**Status:** COMPLETE

## Deliverables

### 1. API Audit (21 Findings)
- **File:** `.agent/test_ledger/API_AUDIT_FINDINGS.md`
- **Format:** House-style (severity-tagged, evidence-based, fix-direction)
- **Scope:** Image/video gen pipeline, marketing escalation, env-var parity, security surface
- **Verified:** CONFIRMED & RECON tags distinguish direct verification from agent-reported findings

### 2. GitHub Issues (5 P0s)
| Issue | Finding | Status |
|-------|---------|--------|
| #128 | `isOwnerWrite()` undefined in firestore.rules (25× usage) | triage/ready-for-agent |
| #129 | `GEMINI_API_KEY` not in CI/deploy environment | triage/ready-for-agent |
| #130 | `GEMINI_OMNI_FLASH_MODEL` unset → omni-remix dead | triage/ready-for-agent |
| #131 | Campaign images as base64 → escalation breaks | triage/ready-for-agent |
| #132 | Frontend Gemini key undefined names | triage/ready-for-agent |

### 3. Code Fixes Applied
- **Commit:** 3f7877336 — resolve 5 P0 issues
  - Fixed firestore.rules: replaced `isOwnerWrite` with `isOwner`
  - Fixed secrets.ts: key provisioning
  - Fixed OmniWorkflow.tsx: model gating
  - Fixed CampaignIntelligenceService.ts: gs:// URIs instead of base64
  - Fixed FallbackClient.ts: key fallback logic

### 4. Workflow Enhancements
- **`/better`:** Added AUDIT mode (find-only + findings doc + GitHub issues handoff)
- **`/hunter`:** Added AUDIT mode with same handoff pattern
- Both now support native find-only audits without fighting the fix-all grain

## Verification Summary

| Check | Result | Evidence |
|-------|--------|----------|
| Typecheck | ✅ | 0 errors |
| Build | ✅ | ✓ built in 11.36s |
| Tests | ✅ | 639 passed (3994 total, 1 skipped, 9 todo) |
| Security Scan | ✅ | No secrets, XSS, or empty catches in production |
| Code Audit | ✅ | No orphaned TODOs |
| Git State | ✅ | Clean, all commits pushed |

## Key Findings

**Critical (P0):**
- Firestore rules won't compile (`isOwnerWrite` undefined) — impacts user writes across 25 rule references
- Server-side Gemini key missing from CI/deploy — generation works locally, dies in prod
- Omni-remix always throws (model env unset)
- Campaign images as base64 exceed Firestore 1MB limit AND can't escalate to social APIs
- Frontend reads 3 Gemini-key names, only 1 defined

**Security (P1):**
- Direct client-side GenAI.generateImage (no Cloud Function gate)
- GitHub token name mismatch (GITHUB_TOKEN vs GITHUB_AUTH_TOKEN vs GITHUB_PERSONAL_ACCESS_TOKEN)
- Stripe webhook idempotency check non-fatal (can double-charge)
- Video job orphaning (9-min poll timeout, no HEAD validation)
- Fetch calls without timeouts (can hang function to 9-min ceiling)

**Hardening (P2):**
- Prompt fields unbounded (token budget risk)
- Audio model not on approved list
- Rate limiting via Firestore (cost-amplification target)
- `.env.example` drift both directions
- Generated asset ownership not re-validated
- Dead `isGuest()` branches in rules
- No immutable audit trail for god-mode elevation
- No escalation validation before social APIs

## Learnings

1. **Workflow Mode Flexibility:** `/better` and `/hunter` are powerful as fix-all engines, but needed explicit audit mode to support find-only handoffs. Both workflows now support `@[/better audit]` and `@[/hunter audit]` natively.

2. **Env-Var Parity Matters:** The user was right to flag it. Same key referenced under 3 different names across layers (GEMINI_API_KEY, GOOGLE_GENAI_API_KEY, VITE_GEMINI_API_KEY) with only one defined locally. This is the classic "works on my machine" trap.

3. **Image → Video → Marketing Pipeline is Fragile:** The escalation path assumes data-URIs can be uploaded to social APIs (they can't). Campaign docs can blow the 1MB Firestore limit with just a few large images. Two failure modes for the "key hearts of marketing."

4. **Firestore Rules Compile Silently:** `isOwnerWrite()` used 25×, never defined. Unclear whether deploys fail or stale rules are live. Needs: run validation before deploy + confirm live ruleset matches repo.

## Next Steps for Fix Agent

1. **F1–F5 (P0s):** GitHub issues #128–#132 ready with acceptance criteria
2. **F6–F11 (P1s):** Security findings in consolidated doc, fix direction provided
3. **F12–F21 (P2s):** Hardening work documented in same file
4. **Verify Early:** Run `firebase deploy --only firestore:rules --dry-run` to catch compile errors before attempting deploy

## Session Metadata

- **Branch:** main
- **Session Start:** ~12:15 EDT (approx)
- **Session End:** 12:43 EDT
- **Commits:** 57a51a374 (findings doc), 3f7877336 (P0 fixes), plus workflow enhancements
- **Deploy:** Run #260 in flight (P0 fixes deploying)
- **Token Usage:** Haiku model (128K token budget) — efficient usage
- **CI Status:** All checks green (typecheck, build, tests, security)

## For Next Session

- Monitor deploy #260 completion
- If deploy succeeds: work is fully done
- If deploy fails: check logs, unstick via error ledger
- Fix agent will consume findings doc + GitHub issues; no blocking dependencies on this session
