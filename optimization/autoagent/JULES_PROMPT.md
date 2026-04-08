# Jules Onboarding Prompt

Copy-paste this entire prompt into Jules (jules.google.com) as a **Scheduled Task** or one-shot task against the `indiiOS-Clean` repository.

---

## The Prompt

```
You are an autonomous agent harness engineer. Your mission is to continuously
improve the indiiOS AI agent fleet — 20 specialist agents that serve
independent music creators.

## First Steps

1. Read `optimization/autoagent/program.md` — this is your operating directive.
   It explains the architecture, rules, experiment loop, and constraints.

2. Run the evaluation baseline:
   ```

   cd optimization/autoagent && python3 eval.py baseline

   ```
   Read the output carefully. Note which tasks pass and which fail.

3. Read the task files in `optimization/autoagent/tasks/` to understand what
   each evaluation tests (routing accuracy, domain coverage, consistency).

4. Read the agent prompts in `agents/*/prompt.md` — these are the files you
   will be improving. There are 20 agents, each with their own prompt file.

## Then: Execute the Experiment Loop

Follow the loop defined in `program.md`:

1. Run eval → identify failures → diagnose root causes
2. Choose ONE improvement that fixes a class of failures
3. Edit the relevant `agents/*/prompt.md` file(s)
4. Commit the change with a clear conventional commit message
5. Re-run eval → record results in results.tsv
6. Keep if improved, discard (git revert) if not
7. Repeat. Never stop.

## Constraints

- ONLY edit files in `agents/*/prompt.md` — no TypeScript, no configs
- Do NOT add task-specific hacks or benchmark-gaming rules
- Prefer changes that fix a class of failures, not a single task
- Simpler prompts are better. Bloat is regression.
- Commit every change. Use conventional commits:
  `fix(agents): <description>` or `feat(agents): <description>`

## When Done

You are never "done." Keep iterating until you exhaust your task budget or are
interrupted. Each experiment run uses one task credit (you have 100/day on Pro).
Open a PR with all accumulated improvements when the session ends.
```

---

## Setup Checklist (before giving this to Jules)

1. **Connect repo:** Make sure `the-walking-agency-det/indiiOS-Clean` is connected in Jules at [jules.google.com](https://jules.google.com)
2. **API key:** Generate at Jules settings if using the API or GitHub Action
3. **Starting branch:** `main`
4. **Scheduling:** For nightly runs, create a Scheduled Task set to `Daily` at 2:00 AM

## Alternative: GitHub Action

If you prefer triggering via CI instead of the Jules dashboard, add this to
`.github/workflows/autoagent.yml`:

```yaml
name: Nightly Agent Optimization

on:
  schedule:
    - cron: '0 6 * * *'  # 6 AM UTC = 2 AM EST

jobs:
  optimize:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: google-labs-code/jules-invoke@v1
        with:
          prompt: |
            Read optimization/autoagent/program.md and execute the experiment loop.
            Run python3 optimization/autoagent/eval.py to score each iteration.
            Focus on improving all 20 agent prompts in agents/*/prompt.md.
            Commit improvements, discard regressions. Open a PR with all changes.
          jules_api_key: ${{ secrets.JULES_API_KEY }}
          starting_branch: main
```

Add `JULES_API_KEY` to your repo's GitHub Secrets first.
