# Testing System Index
## Start Here - All Testing Resources

**All agents:** Bookmark this page. Everything you need is linked below.

---

## Quick Start (Pick Your Use Case)

**I need to fix code:**
→ Read: [`README_TESTING_SYSTEM.md`](#quick-reference) (2 min read)
→ Pattern: Fix → `npm run test:integration:ci` → Commit

**I need the full details:**
→ Read: [`TESTING_INTEGRATION_GUIDE.md`](#full-guide) (10 min read)
→ Covers: Rabbit + Sentry + Integration Tests + AI System

**I need to design a new workflow:**
→ Read: [`TESTING_INTEGRATION_GUIDE.md` → Workflows section](#full-guide)
→ Example workflows: auto-fix, ci-validate, health_audit, go

**I need to understand the high-level vision:**
→ Read: [Testing Plan](../.claude/plans/encapsulated-riding-spark.md) (planning-mode document)
→ Covers: Why this system, how it impresses executives

---

## Resources

### Quick Reference
📄 **[README_TESTING_SYSTEM.md](./README_TESTING_SYSTEM.md)**
- TL;DR: The four systems (Rabbit, Tests, Sentry, AI)
- The pattern every agent should follow
- Commands you'll use
- Where to find things

### Full Guide
📖 **[TESTING_INTEGRATION_GUIDE.md](./TESTING_INTEGRATION_GUIDE.md)**
- How Rabbit + Sentry + Integration Tests + AI work together
- All workflows that use this system
- Health dashboard explained
- GitHub Issue creation patterns
- Example workflows (Sentry fix, health check, PR review)

### Planning Document
📋 **[.claude/plans/encapsulated-riding-spark.md](../.claude/plans/encapsulated-riding-spark.md)**
- Full vision: World-class testing system design
- Current state (mocked integration tests) + Future state (real APIs)
- Three tiers: Integration tests + Health dashboard + Continuous monitoring
- Why this matters
- Integration with Rabbit, Sentry, AI System

---

## Updated Workflows

These workflows now require integration tests:

- 🔧 **[auto-fix.md](./workflows/auto-fix.md)** — Fix Sentry/Rabbit issues + verify with tests
- 🔄 **[go.md](./workflows/go.md)** — Recursive loop with testing gate

Planned workflows:
- ✅ **[ci-validate.md](./workflows/ci-validate.md)** — Gate PRs with tests (planned)
- 🏥 **[health_audit.md](./workflows/health_audit.md)** — Daily health checks (planned)

---

## The Core Pattern (Memorize This)

```
TASK (Sentry error, Rabbit comment, GitHub Issue)
  ↓
FIX CODE
  ↓
RUN: npm run test:integration:ci  ← MANDATORY (not lint/typecheck alone)
  ↓
Tests Pass?
  ├─ YES → git commit + push
  └─ NO  → gh issue create (with error details)
```

---

## Commands Reference

```bash
# Run integration tests (real APIs, not mocks)
npm run test:integration:ci

# Generate health dashboard
npm run health:generate-dashboard

# Run health checks daily
npm run health:check

# Create GitHub Issue on failure
gh issue create --title "Integration test failed" \
  --body "..." \
  --label "health-check-failure"
```

---

## Health Dashboard

**Location:** `https://{firebase-hosting}/health.html`
**Access:** Firebase Auth protected (team only)
**Updated by:** Daily health checks + Sentry metrics + CI data
**Shows:** Rabbit quality + Integration health + Sentry metrics + SLA compliance

---

## For New Agents

When you start a task:

1. Read [`README_TESTING_SYSTEM.md`](./README_TESTING_SYSTEM.md) (quick reference)
2. If you need details, read [`TESTING_INTEGRATION_GUIDE.md`](./TESTING_INTEGRATION_GUIDE.md)
3. Follow the core pattern: Fix → Test → Verify → Commit
4. Create GitHub Issues on failure (auto-creates record for tracking)
5. Done

---

## What Got Updated (June 3, 2026)

✅ Created comprehensive planning document (encapsulated-riding-spark.md)  
✅ Created TESTING_SYSTEM_INDEX.md (master index for agents)  
✅ Created TESTING_INTEGRATION_GUIDE.md (comprehensive reference)  
✅ Created README_TESTING_SYSTEM.md (quick TL;DR)  
✅ Updated auto-fix.md with integration test verification step  
✅ Updated go.md to gate completion on verified tests  
✅ Added npm scripts: test:integration:ci, health:check, health:generate-dashboard  
✅ Corrected docs: integration tests are mocked (not real APIs yet), marked future enhancements as planned  

---

## Questions?

- **Quick question?** Check README_TESTING_SYSTEM.md
- **Need full context?** Read TESTING_INTEGRATION_GUIDE.md
- **Need design details?** Check the planning document
- **Need to see example workflow?** Check TESTING_INTEGRATION_GUIDE.md → Workflows section

---

*All agents have access to this folder. No special permissions needed.*

*Last updated: 2026-06-03*
