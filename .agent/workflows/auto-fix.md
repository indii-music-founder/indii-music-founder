---
description: Automatically fetch and fix Sentry issues and CodeRabbit PR comments
---

# Auto Fix Workflow

**See:** `.agent/TESTING_INTEGRATION_GUIDE.md` for how this integrates with Rabbit, Sentry, and integration tests.

When the `/auto-fix` workflow is triggered, Antigravity should autonomously find and resolve active Sentry issues and open CodeRabbit PR comments. All fixes must pass integration tests before committing.

## Steps

1. **Check Sentry Issues**
   Use the local MCP tool or curl to fetch unresolved Sentry issues:
   ```bash
   export $(grep -v '^#' .env | xargs) && curl -s -H "Authorization: Bearer $SENTRY_TOKEN" "https://sentry.io/api/0/projects/thewalkingagency/indii/issues/?query=is:unresolved" | jq '.[0:5] | map({id, title, metadata})'
   ```
   If issues are found, read the corresponding files, analyze the stack traces, and apply fixes using `replace_file_content`.

2. **Check GitHub PRs for CodeRabbit Comments**
   Fetch open PRs and their review comments:
   ```bash
   export $(grep -v '^#' .env | xargs) && curl -s -H "Authorization: Bearer $GITHUB_TOKEN" "https://api.github.com/repos/indii-music-founder/indii-music-founder/pulls?state=open" | jq '.[0:3] | map({number, title})'
   ```
   For each PR, fetch the comments. If CodeRabbit has left actionable feedback, read the files and apply the requested changes.

3. **Verify Fixes with Integration Tests**
   **CRITICAL:** Always run integration tests (not just lint/typecheck). See TESTING_INTEGRATION_GUIDE.md.
   ```bash
   npm run typecheck && npm run lint
   npm run test:integration:ci     # Real API validation (mandatory)
   ```
   If integration tests fail, revert changes and create GitHub Issue with error details.
   If pass, proceed to commit.

4. **Commit and Push**
   When `/auto-fix` is standalone, create one coherent `main` commit with all related code, tests, and ledger evidence. When invoked inside `/go`, `/end`, or `/issue-sweep`, do not create an intermediate commit; return the verified changes to the parent workflow's single delivery.
   ```bash
   git add <auto-fix-task-files>
   git commit -m "fix(auto): resolve Sentry/CodeRabbit issues - integration tests passing"
   git push origin HEAD:main
   ```

5. **Report**
   Summarize the fixed issues and provide the user with a brief report.
> **Mainline delivery gate:** Before any code, git, CI, push, or optional branch action, read and obey [`branch-safety.md`](branch-safety.md). Direct-to-`main` is mandatory unless the user explicitly requests a branch.
