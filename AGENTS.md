# Agent Operating Notes

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
