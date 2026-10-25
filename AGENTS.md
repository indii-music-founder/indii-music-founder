# Agent Operating Notes

## Protected Main Delivery Standard

Deliver repository changes through focused task branches and reviewed PRs into protected `main`. Before any code, git, CI, or push action, read and obey `.agent/workflows/branch-safety.md`.

Publish one coherent locally validated change to a task branch, open a PR, and inspect CI for its exact head SHA. Merge only after the required `test` check, a qualifying approving review, and user authorization for that merge. Never push directly to `main`, create checkpoint commits, bypass protection, force-push, guess at CI failures, or bundle unrelated work.

## User GitHub Completion Preference

For this user's repository work, a local change or commit is not a completed
deliverable. Publish the task branch and open the PR, then verify the remote
branch SHA, PR head, and CI status before reporting completion. Do not merge or
deploy unless the user explicitly asks. If the normal Git push path fails, check the already
authorized GitHub connection before calling the work blocked; do not switch to
an unauthorized credential or authentication path. Coordinate with other
agents first and do not duplicate or overwrite their work.

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
