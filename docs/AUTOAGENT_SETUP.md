# AutoAgent Setup & Runbook

This document covers everything needed to operate the nightly AutoAgent
optimization loop for the indii Conductor system prompt.

For background on what AutoAgent is and how Phase A was scaffolded, see:
- `optimization/autoagent/README.md` — sidecar contents and local smoke test
- `.agent/AUTOAGENT_HANDOFF.md` — full multi-phase plan (A/B/C)

---

## What this enables

A GitHub Actions workflow (`.github/workflows/autoagent-nightly.yml`) runs
the [`kevinrgu/autoagent`](https://github.com/kevinrgu/autoagent) meta-agent
against `optimization/autoagent/agent.py` every night. The meta-agent
hill-climbs on the routing tasks under `optimization/autoagent/tasks/`,
edits the `SYSTEM_PROMPT` constant, keeps changes that improve the rolling
mean reward, and the workflow then opens a PR with the resulting prompt
delta synced into `agents/agent0/prompt.md`.

A human reviews and merges every PR. The nightly job never modifies prod
agent behavior on its own.

---

## One-time setup

### 1. Required secrets

Set these in **Settings → Secrets and variables → Actions**:

| Secret | Required | Notes |
|---|---|---|
| `OPENAI_API_KEY` | ✅ yes | The meta-agent uses OpenAI's `gpt-5` by default. Set a billing limit on the key in the OpenAI dashboard before enabling the schedule. Recommended: $50/month soft cap, $200 hard cap. |
| `GITHUB_TOKEN` | auto | Provided by GH Actions; the workflow uses it to create PRs. No manual setup. |

### 2. Verify Docker-in-Docker on the runner

The workflow targets `ubuntu-latest`, which supports Docker out of the box.
Harbor runs each task in its own container, so DinD is required. If you
later switch to a self-hosted or smaller runner, confirm `docker version`
succeeds in the workflow logs.

### 3. Trigger a manual smoke run

Before letting the nightly schedule kick in, run the workflow manually with
a tiny iteration cap to validate the full pipeline:

1. Go to **Actions → AutoAgent — Nightly Conductor Optimization**
2. Click **Run workflow**
3. Set:
   - `n_iterations` = `2`
   - `task_filter` = `routing-isrc`
4. Watch the run complete. Expected outcome:
   - `uv sync` installs deps in ~30s
   - Harbor runs 2 iterations × 1 task = ~2 task executions
   - If the meta-agent edited `agent.py`, a PR appears titled "AutoAgent
     nightly #N: Conductor prompt update"
   - If it didn't, the run completes cleanly with no PR (this is fine —
     2 iterations is too few to expect a winning move)

If the smoke run succeeds, you can leave the schedule enabled. If it fails,
fix the failure before enabling — do not let a broken nightly job keep
firing.

---

## Cost expectations

The nightly job runs once per day. With the default `N_ITERATIONS_DEFAULT=50`
in the workflow:

- Per iteration: ~3 task executions (one per task in `tasks/`)
- Per task execution: ~1k–5k input tokens, ~500–2k output tokens (gpt-5)
- Total per night: roughly 150 task executions

At gpt-5 list pricing, expect **$10–$50 per nightly run**, with high
variance depending on how often the meta-agent retries. Over a month
that's **$300–$1500**.

**Hard caps in place:**
- Workflow `timeout-minutes: 360` — the job dies after 6 hours regardless
- `--n-iterations` cap — bounded number of meta-agent iterations
- OpenAI billing limit (you set this in the OpenAI dashboard, NOT in this repo)

**If costs surprise you:** lower `N_ITERATIONS_DEFAULT` in the workflow file
or switch the schedule to weekly (`'0 4 * * 0'`).

---

## What gets PR'd, and what doesn't

| Change kind | PR opened? |
|---|---|
| Meta-agent edited `SYSTEM_PROMPT` | ✅ yes — sync script writes to `agents/agent0/prompt.md` and the workflow opens a PR |
| Meta-agent edited `MAX_TURNS` or `create_tools` only | ❌ no — the sync script only extracts `SYSTEM_PROMPT`. Other harness changes stay in `agent.py` (unmerged) and are visible in the workflow artifacts |
| Meta-agent didn't change anything | ❌ no — the diff step short-circuits |
| `agent.py` failed to parse | ❌ no — sync script exits 1, workflow fails loudly |

The intentional asymmetry: only prompt changes auto-PR. Tool/structure
changes need a human to look at the artifacts and decide whether to port
them in by hand.

---

## Reviewing a nightly PR

Each AutoAgent PR includes a checklist. Pay attention to:

1. **Specialist names.** The Conductor must only route to specialists in the
   indiiOS hub-and-spoke set: `brand`, `finance`, `legal`, `licensing`,
   `marketing`, `music`, `publicist`, `publishing`, `road`, `social`,
   `video`. If the new prompt mentions a non-existent specialist (e.g.
   "distribution"), close the PR — the meta-agent hallucinated.
2. **Reward trajectory.** Download the workflow artifacts. The
   `jobs/nightly-N/` directory contains per-iteration scores. Confirm the
   rolling mean improved over the run.
3. **Prompt sanity.** Read it like a human. Does it make sense? Does it
   over-fit the 3 seed tasks? Phase C will eventually add hundreds of
   captured user cases — until then, treat the loop as a smoke test, not
   a production optimizer.
4. **Regressions.** Run the smoke test from `optimization/autoagent/README.md`
   locally against the OLD prompt and the NEW prompt; both should still pass.

---

## Disabling the workflow

If something goes wrong and you need to stop the nightly cost burn fast:

1. **Settings → Actions → General → Workflow permissions** — flip to "Read
   repository contents and packages permissions" (kills PR creation)
2. Or comment out the `schedule:` block in `.github/workflows/autoagent-nightly.yml`
3. Or revoke `OPENAI_API_KEY` in the OpenAI dashboard (instant kill)
4. Or delete the workflow file entirely

The OpenAI key revocation is the only true off-switch — the others can be
reverted accidentally.

---

## Known limitations of Phase B

These are real and unsolved. They will be addressed in Phase C or in
follow-up Phase B tickets. Document them when you hit them; do not pretend
they're solved.

1. **Only 3 seed tasks.** With this small a benchmark, the meta-agent will
   over-fit. Phase C adds per-user captured cases to fix this.
2. **No per-tenant prompts.** The Conductor has one global prompt. If
   multi-tenant divergence becomes a real issue, Phase C must address it.
3. **Sync script only handles plain string literals.** If the meta-agent
   ever introduces an f-string or string concat for `SYSTEM_PROMPT`, the
   sync exits with an error and the nightly PR is skipped. Upgrade the
   AST visitor in `sync_winning_prompt.py` if this becomes common.
4. **Harbor + DinD on hosted runners is slow.** Each task spins up a fresh
   container. If runs start timing out at 6 hours, switch to a self-hosted
   runner with the autoagent base image pre-pulled, or move to a Modal
   worker.
5. **No reward-trajectory dashboard.** Reward history lives in workflow
   artifacts only. There is no graph yet. Phase C may add one to the
   `optimization/` panel inside the indiiOS app.
