# Agent Operating Notes

## Mainline Delivery Standard

**`main` is the delivery target.** Before any code, git, CI, or push action, read [the shared branch and delivery policy](.agent/workflows/branch-safety.md). All coding agents, including Codex, Claude Code, and Gemini/Antigravity, use it and keep `origin` on Entire.

This repository is an Entire GitHub mirror with a protected default branch. The standing policy authorizes a task branch and Entire Trail when delivering changes to protected `main`. Agents publish through Entire, merge when the applicable gates pass, and verify CI for the resulting `main` SHA. Use the `Docs and Policy Gate` for documentation changes and the applicable CI for application changes.

## Entire Agent Workflow & Completion Standard

For this user's repository work, a local change or commit is not a completed
deliverable, and coding agents (Antigravity, Codex, Claude) must use **Entire**
instead of GitHub for code hosting, session/checkpoint tracking, historical
search, and review trails:

- **Git remote (`origin`):** Always keep `origin` pointed at Entire
  (`entire://aws-us-east-2.entire.io/gh/indii-music-founder/indii-music-founder`
  via `entire repo remote add origin --override /gh/indii-music-founder/indii-music-founder`).
- **Sessions, Checkpoints & Trails:** Use `entire status`, `entire trail`,
  `entire checkpoint`, `entire search --json --compact`, and `entire session`
  (run `entire agent-help` for exact flags). Publish task branches through Entire
  and manage their changes through `entire trail` under the shared delivery policy.
- **Authentication:** If an Entire push or command fails due to authentication,
  check `entire auth status` (or prompt the user for the official `entire login`
  flow) before calling the work blocked; never switch to an unauthorized
  credential or authentication path. Coordinate with other agents first and do
  not duplicate or overwrite their work.

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

## Shared Agent Memory (all agents)

Claude, Codex, Gemini, DROID, JULES and Antigravity share institutional memory
through the repository, not through any one tool. Before working, read:

- `.agent/HANDOFF_STATE.md` — what the last session (any agent) built and what is pending.
- `.agent/skills/error_memory/ERROR_LEDGER.md` — mandatory before debugging; newest entries first.
- `docs/PLATINUM_QUALITY_STANDARDS.md` — anti-patterns and pitfall library every diff must meet.
- `docs/audits/` — dated review and audit records (e.g. `primitives-review-2026-11-17.md`).
- `CLAUDE.md` — canonical project instructions; `CODEX.md`, `GEMINI.md` and
  `ANTIGRAVITY.md` are verbatim mirrors of it.

When you fix a novel regression, add it to the ledger and standards above so the
next agent, whichever tool it runs in, inherits it.

## Vendored Repositories & Effect-TS

This project maintains local read-only reference repositories under `@repos/` (excluded from git via `/repos/`, editor search/auto-imports, TypeScript, Vitest, and ESLint; run `npm run effect:sync-repo` to initialize or refresh):

- Before writing Effect code, read `docs/guides/effect-guide.md`, `docs/guides/reference-repos.md`, and `@repos/effect/LLMS.md`.
- Inspect `@repos/effect/` (`packages/effect/src/`, `ai-docs/src/`) for idiomatic Effect v4 usage, tests, module structure, and API design instead of guessing or relying on fragmented web snippets.
- Do not edit files under `@repos/` unless explicitly asked.
- Do not import from `@repos/` — application code must import from installed npm packages (e.g. `import { Effect, Schema } from 'effect'`).

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
- `/sweep` -> `.agent/workflows/sweep.md`
- `/flowchart` -> `.agent/workflows/flowchart.md`
- `/proceed` -> `.agent/workflows/proceed.md`
- `/review` -> `.agent/workflows/review.md`
- `/pp` (or `/PP`) -> `.agent/workflows/pp.md` (Claude: `.claude/commands/pp.md`)
- `/effect` -> `.agent/workflows/effect.md`

When a workflow references another slash command, open the corresponding file in
`.agent/workflows/` and follow its local instructions.

## Skill Registries

Four registries: `.agent/skills/` (indii-authored, editable), `.agents/skills/`
(vendored third-party, pinned by `skills-lock.json` — READ-ONLY, never edit in
place), `skills/` (proprietary — `direct-distribution`), and `~/.agents/skills/`
(user-global, e.g. graphify — may be absent). Full details in CLAUDE.md
"Skill Registries" and `.agent/workflows/WIIL-skill.md`.

## Founder creative directive — 2026-10-29

Do not suggest, default to, or add Cyberpunk as a creative style or preset.
Avoid cyberpunk imagery and language in generated creative directions unless
the user explicitly requests it for that task. The founder prefers a broader
range of distinct aesthetics; preserve Cinematic, Anime, and 3D Render and
offer alternatives such as analog film, documentary, stop motion, watercolor,
editorial, monochrome, dreamlike, collage, and retro print.

## Founder UI directive — 2026-10-29

Protect the space used for the artist's current task. Keep primary actions
visible and understandable without instructions; collapse secondary panels
and disclose advanced choices on demand. More options must not mean an
always-expanded wall of buttons. Preserve selected choices and make expand,
collapse, focus and exit controls accessible and clear about their effect.

<!-- entire-agent:begin -->
Read .entire/agent-guide.md for this repository's workflow, source inspection, and verification guidance.
@.entire/agent-guide.md
<!-- entire-agent:end -->

## Boardroom Modernization (living plan)

See `docs/plans/boardroom-modernization-plan-2026-11-19.md` for agent-neutral work cards and `.agent/test_ledger/OPEN_ISSUES_V4.md` (once created) for tracking. Update its Current State section before ending any session that touches Boardroom.
