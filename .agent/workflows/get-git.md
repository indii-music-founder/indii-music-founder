---
description: Fetch Entire main and safely fast-forward a clean local main checkout.
---

> [!IMPORTANT]
> **CRITICAL ISSUE TRACKING RULE:**
> You MUST ONLY log issues in `.agent/test_ledger/OPEN_ISSUES_V4.md`. Do NOT create new or standalone markdown files (like BROWSER_ISSUES.md or issue-specific files) for issues.
> **Ledger target:** the master ledger is `.agent/test_ledger/OPEN_ISSUES_V4.md`. Once `OPEN_ISSUES_V4.md` exists, use the highest-numbered unsealed `OPEN_ISSUES_V*.md` instead. Never write to a sealed ledger (V2 was sealed 2026-08-02).

# /get-git — Repository Sync

Run `node scripts/git_monitor_sync.js` to fetch Entire's `origin/main`, report local divergence, and fast-forward a clean local `main` when possible. Preserve local commits and unrelated changes. Report the exact state when the monitor cannot fast-forward.

Publish task work using the shared branch policy. The team handles GitHub review, CI, and merging.

> **Mainline delivery gate:** Read [`branch-safety.md`](branch-safety.md) before code, git, or CI actions. It defines delivery through Entire, including the automatic Trail route for protected `main`.
