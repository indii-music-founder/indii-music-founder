# indiiOS AutoAgent Sidecar — Phase A

A standalone Python sidecar that runs [`kevinrgu/autoagent`](https://github.com/kevinrgu/autoagent)
against the indii Conductor's system prompt to hill-climb routing accuracy on
a fixed set of tasks.

This is **Phase A only** — proof that the loop spins end-to-end. Nightly CI
(Phase B) and in-app eval capture (Phase C) are described in
`.agent/AUTOAGENT_HANDOFF.md` at the repo root and are not built here.

---

## What it does

1. `agent.py` defines the indii Conductor as a Harbor agent harness. The
   `SYSTEM_PROMPT` constant near the top of the file is the only thing the
   meta-agent should rewrite.
2. `tasks/` contains 3 deterministic routing tasks. Each one shows the
   Conductor a realistic artist question and verifies that it picks the
   correct specialist (`publishing`, `road`, or `finance`) by reading
   `/task/answer.txt`.
3. `program.md` tells the meta-agent what it may modify and what it must not.
4. The meta-agent (autoagent itself) iteratively edits `agent.py`, runs all
   tasks, scores the result, and keeps changes that improve the rolling mean.

---

## Prerequisites

- Python 3.12+
- [`uv`](https://github.com/astral-sh/uv): `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Docker (Harbor runs each task inside its own container)
- An OpenAI API key with access to the model named in `agent.py` (default `gpt-5`)

---

## Setup

```bash
cd optimization/autoagent
uv sync
export OPENAI_API_KEY=sk-...
```

`uv sync` reads `pyproject.toml`, creates a `.venv/` here, and installs
`openai-agents` and `harbor`.

---

## Smoke test (run a single task once)

This is the **Phase A acceptance criterion**. It does NOT invoke the
meta-agent — it just runs the Conductor against one task to confirm the
plumbing works end-to-end.

```bash
uv run harbor run \
  -p tasks/ \
  --task-name indii/routing-isrc \
  -l 1 -n 1 \
  --agent-import-path agent:AutoAgent \
  -o jobs --job-name smoke \
  > run.log 2>&1
```

Success criteria:
- Exit code 0
- `jobs/smoke/.../logs/verifier/reward.txt` exists and contains `1` or `0`
- `run.log` shows a `turns=N duration_ms=M input=X output=Y` line

The reward value does not need to be 1 — Phase A only proves the loop runs.
A reward of 0 just means the seed prompt failed that task, which is exactly
what the meta-agent will later try to fix.

---

## Full optimization run (when you're ready)

This is what Phase B's nightly CI will invoke. Do **not** run this by hand
without setting a budget — it can be expensive.

```bash
uv run harbor run \
  -p tasks/ \
  -n 50 \
  --agent-import-path agent:AutoAgent \
  -o jobs --job-name latest \
  > run.log 2>&1
```

`-n 50` caps the number of meta-agent iterations. Each iteration runs all
tasks once, so total task executions ≈ `n * len(tasks)`. With 3 tasks and
`n=50` that's 150 task runs. Budget accordingly.

---

## File map

```
optimization/autoagent/
├── README.md             # this file
├── pyproject.toml        # uv-managed deps: openai-agents, harbor
├── .gitignore            # excludes .venv/, jobs/, results.tsv, run.log
├── agent.py              # the harness — SYSTEM_PROMPT lives here
├── program.md            # meta-agent directive: what to optimize
└── tasks/
    ├── routing-isrc/     # expected: publishing
    ├── routing-tour/     # expected: road
    └── routing-finance/  # expected: finance
```

Each task directory contains:
- `task.toml` — Harbor task config (timeouts, resources, internet=false)
- `instruction.md` — the artist question shown to the Conductor
- `tests/test.sh` — Harbor verifier entrypoint, writes `/logs/verifier/reward.txt`
- `tests/test.py` — Python verifier, exact-match checks `/task/answer.txt`
- `environment/Dockerfile` — minimal `python:3.12-slim` + bash

---

## What NOT to do

- Don't run `harbor run` without `-n` and a budget — open-ended runs cost real money.
- Don't edit the `FIXED ADAPTER BOUNDARY` section of `agent.py`. It implements
  the Harbor `BaseAgent` contract.
- Don't add internet-enabled tasks. All current tasks set `allow_internet = false`
  for determinism and cost control.
- Don't add this directory as a workspace package in the root `package.json`.
  It is intentionally a Python island.
- Don't commit `.venv/`, `jobs/`, `results.tsv`, or `run.log`. The local
  `.gitignore` covers them — keep it that way.

---

## Next phases

See `.agent/AUTOAGENT_HANDOFF.md` for the full Phase B (nightly Jules CI) and
Phase C (in-app eval capture) plans. Do not start Phase B until the smoke test
above runs green on a real machine with a real API key.