---
description: Host-neutral visual QA workflow. Routes to the owned auto_qa skill, requires an approved available browser capability, and preserves honest structural/simulated/local-real/production-real evidence boundaries.
---

# /auto_qa — Visual QA

Read `.agent/skills/auto_qa/SKILL.md` completely and follow it.

Before live-user, browser end-to-end, release-acceptance, demo-readiness, production, or free-tier validation, read `.agent/REAL_USER_AUTHENTICITY.md`. Confirm the exact environment, genuine account/session, entitlement state, intended path, cost boundary, and approved browser capability.

Do not depend on `AGENT_BRIDGE.md`, a fixed localhost port, one browser provider, injected authentication, mocks, seeded data, or fabricated service responses. If real state is unavailable, report the strongest honest structural or simulated evidence and the missing official prerequisite.

Output a bounded report with environment, evidence level, path, decisive DOM/screenshot/console evidence, actions intentionally not taken, and PASS/PARTIAL/FAIL verdict.

> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
