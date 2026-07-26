# Agent Operating Notes

## Mainline Delivery Standard

This repository works directly on `main`. Do not create, switch to, push, or continue work on a task branch unless the user explicitly requests that branch workflow for the current task. Before any code, git, CI, or push action, read and obey `.agent/workflows/branch-safety.md`.

Deliver one coherent locally validated commit to `origin/main` with the explicit refspec `git push origin HEAD:main`, then inspect the CI run for that exact SHA. Fix only logged root causes on `main` until green. Never create checkpoint commits, force-push or rewrite `main`, guess at CI failures, or bundle unrelated work.

## Real-User Authenticity Standard

Before any agent performs live-user, browser, end-to-end, release-acceptance,
demo-readiness, production, or free-tier validation, read and obey
`.agent/REAL_USER_AUTHENTICITY.md`.

No agent may use mocks, seeded product data, bypassed or injected
authentication, impersonated sessions, fabricated service responses, or
artificial plan/tier/entitlement state for those claims. If genuine credentials
or verification are unavailable, stop and request the official authorization
flow. Never substitute simulated state. Legacy mock-backed tests are
structural-only and are not proof that a customer path works.

## Slash Workflows

This repo keeps its slash-command workflow docs in the hidden folder
`.agent/workflows/`.

Before treating a user slash command as plain text, check that folder for the
matching workflow file. Common commands include:

- `/start` -> `.agent/workflows/start.md`
- `/middle` -> `.agent/workflows/middle.md`
- `/end` -> `.agent/workflows/end.md`
- `/go` -> `.agent/workflows/go.md`
- `/better` -> `.agent/workflows/better.md`
- `/flowchart` -> `.agent/workflows/flowchart.md`
- `/proceed` -> `.agent/workflows/proceed.md`
- `/review` -> `.agent/workflows/review.md`

When a workflow references another slash command, open the corresponding file in
`.agent/workflows/` and follow its local instructions.

## Skill Registries

Four registries: `.agent/skills/` (indii-authored, editable), `.agents/skills/`
(vendored third-party, pinned by `skills-lock.json` — READ-ONLY, never edit in
place), `skills/` (proprietary — `direct-distribution`), and `~/.agents/skills/`
(user-global, e.g. graphify — may be absent). Full details in CLAUDE.md
"Skill Registries" and `.agent/workflows/WIIL-skill.md`.
