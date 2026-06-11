# Issue Tracker: GitHub

Issues and PRDs for indii live as GitHub issues in `indii-music-founder/indii-music-founder`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`
- **List issues**: `gh issue list --state open` with optional `--label` and `--state` filters
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## Filtering by Triage State

Use label filters to find issues by triage state:

```bash
# Issues needing maintainer assessment
gh issue list --label "triage/eval-needed" --state open

# Issues awaiting reporter info
gh issue list --label "triage/awaiting-info" --state open

# Agent-ready issues (fully specified)
gh issue list --label "triage/ready-for-agent" --state open

# Human implementation queue
gh issue list --label "triage/ready-for-human" --state open

# Decided not to pursue
gh issue list --label "wontfix" --state open
```

## When a skill says "publish to the issue tracker"

Create a GitHub issue with appropriate triage label.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments` to pull full issue context.
