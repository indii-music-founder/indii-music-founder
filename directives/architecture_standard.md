# 3rd-Layer Architecture Standardization Directive

## Goal

Maintain the project's reliability by strictly enforcing the separation of Directive, Orchestration, and Execution layers.

## Required Inputs

- New feature or task description.

## Operating Rules

1. **Never perform heavy lifting in Orchestration:** If a task requires logic (loops, API parsing, file manipulation), write a script in `execution/` first.
2. **Follow the Blueprint:** Every major task must have a corresponding `.md` file in `directives/`.
3. **Mirroring:** Keep `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, and `DROID.md` in perfect sync.
4. **The Operator Command:** Use `/opp` to trigger the Orchestration layer and assume control of the task flow.

## Verification

- Check for existence of `directives/` and `execution/` on every session start.
