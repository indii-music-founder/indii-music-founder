---
description: Automatically fetch and fix Sentry issues and CodeRabbit PR comments
---

# Auto Fix Workflow

When the `/auto-fix` workflow is triggered, Antigravity should autonomously find and resolve active Sentry issues and open CodeRabbit PR comments.

## Steps

1. **Check Sentry Issues**
   Use the local MCP tool or curl to fetch unresolved Sentry issues:
   ```bash
   export $(grep -v '^#' .env | xargs) && curl -s -H "Authorization: Bearer $SENTRY_TOKEN" "https://sentry.io/api/0/projects/thewalkingagency/indiios/issues/?query=is:unresolved" | jq '.[0:5] | map({id, title, metadata})'
   ```
   If issues are found, read the corresponding files, analyze the stack traces, and apply fixes using `replace_file_content`.

2. **Check GitHub PRs for CodeRabbit Comments**
   Fetch open PRs and their review comments:
   ```bash
   export $(grep -v '^#' .env | xargs) && curl -s -H "Authorization: Bearer $GITHUB_TOKEN" "https://api.github.com/repos/new-detroit-music-llc/indiiOS-Clean/pulls?state=open" | jq '.[0:3] | map({number, title})'
   ```
   For each PR, fetch the comments. If CodeRabbit has left actionable feedback, read the files and apply the requested changes.

3. **Verify Fixes**
   Run local validation to ensure the codebase remains stable:
   ```bash
   npm run typecheck && npm run lint
   ```

4. **Commit and Push**
   Automatically commit the changes with a descriptive message referencing the Sentry issue ID or CodeRabbit review.
   ```bash
   git commit -am "fix(auto): resolve Sentry/CodeRabbit issues"
   git push
   ```

5. **Report**
   Summarize the fixed issues and provide the user with a brief report.
