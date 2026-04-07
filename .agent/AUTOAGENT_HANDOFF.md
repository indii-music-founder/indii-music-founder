# AutoAgent Integration — Session Handoff

**Branch:** `claude/review-autoagent-library-mFRAD`
**Written:** 2026-04-07 (mobile session, continue on desktop IDE)
**Status:** Plan locked, zero code written yet. Bootstrap done.

---

## The Goal (in one paragraph)

Install [`kevinrgu/autoagent`](https://github.com/kevinrgu/autoagent) — a meta-agent
that hill-climbs on a benchmark by editing an `agent.py` harness overnight — and
wire it up so:

1. **Jules runs it nightly/weekly** against the indii Conductor (`agents/agent0/`),
   automatically opening a PR with any winning system-prompt deltas.
2. **The same loop powers in-app self-improvement** — registered users' real
   sessions get captured as eval cases, so each artist's agents get smarter the
   more they use indiiOS. This is the actual product wedge for registration.

---

## What AutoAgent actually is (verified from README, not guessed)

| Fact | Implication for indiiOS |
|---|---|
| Python + `uv`, not Node | Lives in a sidecar dir, isolated from npm workspaces. Fits the existing `python/` + `docker-compose.yml` AI Sidecar pattern. |
| Tasks use **Harbor** format — Docker per eval case (`task.toml`, `instruction.md`, `tests/test.sh`, `environment/Dockerfile`) | Each eval case is heavy. Start with 3 seed tasks. |
| Meta-agent **edits `agent.py` directly** — does NOT know about TS source | We need a Python `agent.py` wrapper that proxies to the Conductor and exposes `SYSTEM_PROMPT` as a top-level mutable string. The "winning" prompt has to be extracted and synced back into `agents/agent0/` by a post-run script. |
| No native PR creation | Nightly job has to diff `agent.py`, extract the prompt, write into TS source, open PR via `mcp__github__create_pull_request`. |
| Run command | `uv run harbor run -p tasks/ -n 100 --agent-import-path agent:AutoAgent -o jobs --job-name latest > run.log 2>&1` |
| Single-task debug | add `--task-name "<name>" -l 1 -n 1` |
| Required env | Whatever model the wrapper uses (OpenAI/Anthropic key) |
| Outputs | `jobs/` (gitignored), `results.tsv` (gitignored), `run.log`, modified `agent.py` |

Sources:
- https://github.com/kevinrgu/autoagent
- https://www.marktechpost.com/2026/04/05/meet-autoagent-the-open-source-library-that-lets-an-ai-engineer-and-optimize-its-own-agent-harness-overnight/

---

## The Phased Plan (approved by user, scope = "Full stack: nightly + in-app loop")

This is **3 PRs**, not one commit. Trying to land it as one commit is how the
last session ended up writing nothing.

### Phase A — Sidecar + loop proof  *(start here on desktop)*

Goal: Prove the loop spins on indiiOS hardware. Reward can be 0 — we just need
the harness to execute end-to-end.

Files to create:

```
optimization/autoagent/
├── README.md                       # exact uv commands, env vars, gotchas
├── pyproject.toml                  # autoagent + uv config, python >=3.11
├── .gitignore                      # jobs/, results.tsv, run.log, .venv/
├── agent.py                        # wrapper: HTTP-proxies to a stub Conductor,
│                                   # exposes SYSTEM_PROMPT as top-level str
├── program.md                      # meta-agent steering: optimize SYSTEM_PROMPT,
│                                   # do NOT touch tools/imports/structure
└── tasks/
    ├── routing-isrc/
    │   ├── task.toml               # timeout=120s, metadata
    │   ├── instruction.md          # "User asks how to register an ISRC."
    │   ├── tests/
    │   │   ├── test.sh             # invokes agent, pipes output to test.py
    │   │   └── test.py             # asserts route == "publishing"; writes /logs/reward.txt
    │   └── environment/
    │       └── Dockerfile          # FROM autoagent-base; COPY ../../agent.py /app/
    ├── routing-distribution/        # "When can I release my track to Spotify?"
    │   └── ...                     # expects route == "distribution"
    └── routing-finance/             # "How do royalty splits work?"
        └── ...                     # expects route == "finance"
```

**Stub Conductor for Phase A:** rather than depend on the real TS Conductor
running on localhost, `agent.py` ships with a minimal hardcoded routing function
keyed off `SYSTEM_PROMPT`. The meta-agent's job is to discover that mentioning
specific specialist names in the prompt improves routing accuracy. This proves
the loop works WITHOUT requiring the indiiOS dev server to be running inside
the Docker eval container (which would be a nightmare).

Phase B replaces the stub with a real HTTP call.

**Acceptance criterion for Phase A:**
```bash
cd optimization/autoagent
uv sync
OPENAI_API_KEY=sk-... uv run harbor run -p tasks/ \
  --task-name routing-isrc -l 1 -n 1 \
  --agent-import-path agent:AutoAgent \
  -o jobs --job-name smoke
```
Returns exit 0 and writes a `reward.txt`. Score doesn't matter.

**Commit message:** `feat(autoagent): phase A — sidecar + loop proof for Conductor system prompt optimization`

### Phase B — Nightly Jules CI

Files:
- `.github/workflows/autoagent-nightly.yml`
  - cron: `0 4 * * *` (nightly 4am UTC) + manual `workflow_dispatch`
  - Runs on `ubuntu-latest` initially; switch to self-hosted/Modal if Docker-in-Docker fails
  - Wall-clock cap: 6h. Iteration cap: `-n 50` to control cost.
  - Required secrets (document in PR body): `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`, `AUTOAGENT_BUDGET_USD` (soft cap enforced by wrapper)
- `optimization/autoagent/scripts/sync_winning_prompt.py`
  - Diffs `agent.py` against the committed baseline
  - Extracts new `SYSTEM_PROMPT` value
  - Writes to `agents/agent0/system_prompt.md`
  - Stages + commits + creates PR via `gh`/MCP
- `docs/AUTOAGENT_SETUP.md` — secrets, cost expectations, runbook for Jules

**Risks to write into the PR description:**
1. Anthropic 24h run could cost $50–$200. The `-n 50` cap + budget env var must
   be enforced — never let it run unbounded.
2. Harbor needs Docker-in-Docker. GH Actions hosted runners support this but
   it's slow. May need to switch to a Modal/Fly worker — note this in setup doc.
3. Service-account auth path for the Python wrapper to call any indiiOS HTTP
   endpoint. Phase A skirts this with the stub.

### Phase C — In-app self-improvement capture

This is the actual product wedge. Build only after A + B are landed and the
nightly job has produced at least one successful winning-prompt PR.

Files:
- `packages/shared/src/schemas/agentEvalCase.schema.ts` — Zod schema:
  `{ userId, caseId, input, expectedRoute, expectedOutputSummary, capturedAt, source: 'thumbs_down' | 'manual' }`
- `packages/main/src/services/agent/EvalCaptureService.ts` — Conductor hook:
  on user thumbs-down, modal asks "Save as a teaching example?"; on confirm,
  writes Firestore doc at `users/{userId}/agent_eval_cases/{caseId}`.
- Firestore rule update in `firestore.rules`: users can only read/write their
  own collection.
- `optimization/autoagent/scripts/export_user_cases.py`:
  - Pulls per-tenant cases from Firestore (service account)
  - Generates a Harbor task dir per case under `tasks/user-{userId}-{caseId}/`
  - Runs once before each nightly autoagent invocation
- New module surface: `src/modules/agent/EvalCasesPanel.tsx` — user can review,
  edit, delete their captured cases. Empty state explains the value:
  *"Every thumbs-down here makes your indii smarter overnight."*

**Marketing hook for the registration page:** "Your agents learn from you while
you sleep." This is what justifies the registration wall.

---

## Risks & open questions (do NOT pretend these are solved)

1. **Cost control.** The single biggest risk. Phase B must enforce a hard
   `-n` cap and ideally a wall-clock cap. Phase C multiplies cost per active
   user — needs per-tenant rate limiting.
2. **Docker-in-Docker on Jules / GH Actions.** May fail. Fallback: dedicated
   Modal worker. Test in Phase B before declaring victory.
3. **Authentication from the Python wrapper to a real Conductor endpoint.**
   Phase A dodges this. Phase B may still dodge it (stub is fine for nightly
   if eval cases are routing-only). Phase C requires real auth — needs a
   service-account JWT.
4. **Multi-tenant prompt drift.** If every user's cases drive a single shared
   Conductor prompt, one user's edge cases could regress others. Phase C must
   either (a) keep prompt edits global but require all users' cases to pass,
   or (b) maintain per-user prompt deltas. **This is an unsolved design
   question — flag it loudly when starting Phase C.**
5. **Test budget.** Phase A's 3 seed tasks must be deterministic — no
   LLM-as-judge. Use literal string matching on routing decisions only.

---

## Bootstrap state (already done this session)

- `node_modules` installed via `--ignore-scripts` (ffmpeg-static download
  blocked by network — doesn't matter for typecheck/build of the autoagent dir)
- Typecheck: clean
- Lockfile refresh committed: `318b222`
- Branch synced with origin
- PR #1389 is open against this branch (only contains the lockfile refresh —
  safe to keep open or close)

---

## What to do first on desktop (literal next commands)

```bash
# 1. Confirm we're on the right branch and clean
git status
git branch --show-current

# 2. Install uv if not already installed
curl -LsSf https://astral.sh/uv/install.sh | sh

# 3. Read this doc, then start Phase A
cat .agent/AUTOAGENT_HANDOFF.md

# 4. Phase A scaffolding — create the dir tree above and write the files
#    Do NOT skip program.md — the meta-agent's behavior depends on it
mkdir -p optimization/autoagent/tasks/{routing-isrc,routing-distribution,routing-finance}/{tests,environment}
```

When you start Phase A: read the autoagent README in full first
(`https://github.com/kevinrgu/autoagent/blob/main/README.md`) — it has the
exact `task.toml` schema and the `agent.py` interface contract that this doc
intentionally does not duplicate (would go stale).

---

## What NOT to do

- Do not write a fourth phase. The plan is A → B → C. Stop.
- Do not make the autoagent dir a workspace package. It's intentionally
  isolated from the Node monorepo.
- Do not commit `jobs/`, `results.tsv`, `.venv/`, or any meta-agent run output.
- Do not delete this file when done — convert it into a permanent
  `docs/AUTOAGENT.md` at the end of Phase B.
- Do not start Phase B until Phase A's acceptance criterion runs green locally.
- Do not start Phase C until the nightly job from Phase B has produced at
  least one successful winning-prompt PR in the wild.
