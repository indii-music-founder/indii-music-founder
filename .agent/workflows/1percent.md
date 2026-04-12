---
description: The Final 1% — seal the repository for production-grade release readiness. Run before any major milestone, release, or demo.
---

# /1percent — The Final 1% Sealing Protocol

> Run this workflow before every milestone, release, or demo to ensure the repository
> is polished, secure, and professional. This is the difference between "it works" and "it ships."

## Prerequisites

- You must be on the `main` branch with a clean working tree.
- You must have push access to the GitHub repository.
- The browser subagent must be available for GitHub UI automation.

---

## Phase 1: Repository Metadata & Identity

### Step 1 — Verify LICENSE file exists and is current

```bash
cat LICENSE | head -20
```

- Confirm the license type matches the project's intent (Proprietary for indiiOS).
- Confirm the copyright year is current.
- If missing or stale, create/update the LICENSE file with the correct year and entity (IndiiOS LLC).

### Step 2 — Verify README.md quality

```bash
head -80 README.md
```

Check for:
- [ ] Project name and tagline present
- [ ] Badges (build status, version, license) — add if missing
- [ ] Clear "Getting Started" / installation instructions
- [ ] Tech stack overview
- [ ] Contributing guidelines link (if applicable)
- [ ] No broken links or placeholder text

### Step 3 — Verify CHANGELOG.md is maintained

```bash
head -40 CHANGELOG.md
```

- Confirm the most recent entry matches the latest release tag.
- If using release-please or conventional commits, verify automation is working.

### Step 4 — Verify .gitignore completeness

```bash
cat .gitignore | grep -E "(\.env|node_modules|dist|\.DS_Store|coverage)"
```

Ensure these patterns are present:
- `.env` / `.env.local` / `.env.*.local`
- `node_modules/`
- `dist/` / `build/`
- `.DS_Store`
- `coverage/`
- IDE folders (`.idea/`, `.vscode/` settings if needed)

### Step 5 — Check for committed secrets

// turbo
```bash
git log --all --diff-filter=A -- '*.env' '*.pem' '*.key' 2>/dev/null | head -20
```

// turbo
```bash
grep -rn "sk-\|sk_live_\|ghp_\|AKIA" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" src/ functions/ 2>/dev/null | head -20
```

- If any secrets are found, **STOP** and follow the Quarantine Procedure from the user rules.

---

## Phase 2: Branch & Tag Hygiene

### Step 6 — Clean stale local branches

// turbo
```bash
git branch --merged main | grep -v '^\*\|main\|release-please' | xargs -r git branch -d 2>/dev/null; echo "Remaining branches:"; git branch --list
```

- Delete any branches that have been merged to `main` and are no longer needed.
- Keep `main` and any active release branches.

### Step 7 — Verify remote branch count

// turbo
```bash
echo "Remote branches:"; git branch -r | wc -l; echo "---"; git branch -r | head -20
```

- If remote branches exceed 10, investigate and prune stale ones via GitHub UI or:
  ```bash
  git push origin --delete <branch-name>
  ```

### Step 8 — Verify semantic version tags

// turbo
```bash
echo "Latest 5 tags:"; git tag --sort=-version:refname | head -5; echo "Total tags:"; git tag | wc -l
```

- Confirm tags follow semver (vX.Y.Z).
- Confirm the latest tag matches the latest release.

---

## Phase 3: GitHub Repository Settings (Browser Automation)

### Step 9 — Audit the About section

Use the browser subagent to navigate to the repository's main page on GitHub.

**Verify the About section contains:**
- [ ] A professional, concise description (not the default "No description")
- [ ] The project website URL
- [ ] Relevant topics/tags (aim for 8-12 tags covering tech stack and domain)
- [ ] "Releases" visibility is enabled
- [ ] "Deployments" visibility is enabled

**If any are missing**, use the gear icon (⚙️) next to "About" to update them.

### Step 10 — Check branch protection rulesets

Use the browser subagent to navigate to:
`Settings > Rules > Rulesets`

**Verify `main` branch has a ruleset with:**
- [ ] Restrict deletions
- [ ] Require a pull request before merging (at least 1 approval for teams, optional for solo)
- [ ] Block force pushes
- [ ] Require status checks to pass (link to CI workflow)

**If no rulesets exist**, create one:
1. Click "New ruleset" > "New branch ruleset"
2. Name: `main-protection`
3. Enforcement: Active
4. Target: Default branch
5. Enable: Restrict deletions, Block force pushes
6. Enable: Require status checks (add your CI job names)

### Step 11 — Verify GitHub Releases

Use the browser subagent to check the Releases page.

- [ ] Latest release exists and matches the latest tag
- [ ] Release notes are present (auto-generated or manual)
- [ ] No draft releases lingering without purpose

---

## Phase 4: CI/CD & Build Verification

### Step 12 — Verify CI pipeline passes

// turbo
```bash
echo "Latest CI status:"; gh run list --limit 3 2>/dev/null || echo "GitHub CLI not available — check Actions tab manually"
```

- If `gh` CLI is available, confirm the latest run on `main` is green.
- Otherwise, use the browser subagent to check the Actions tab.

### Step 13 — Verify the build succeeds locally

```bash
npm run build:studio
```

- This should complete without errors.
- If it fails, fix the issues before proceeding.

### Step 14 — Run the test suite

```bash
npm test -- --run
```

- All tests should pass.
- If there are failures, triage: are they flaky, stale, or genuine regressions?

---

## Phase 5: Final Polish

### Step 15 — Check for TODO/FIXME/HACK comments

// turbo
```bash
echo "Remaining TODOs:"; grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" src/ | wc -l; echo "---"; grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" src/ | tail -10
```

- Review the count. A few TODOs are normal; dozens indicate tech debt.
- If any are critical or misleading, resolve them now.

### Step 16 — Verify package.json metadata

// turbo
```bash
node -e "const p = require('./package.json'); console.log('name:', p.name); console.log('version:', p.version); console.log('description:', p.description || 'MISSING'); console.log('author:', p.author || 'MISSING'); console.log('license:', p.license || 'MISSING'); console.log('repository:', JSON.stringify(p.repository) || 'MISSING');"
```

Ensure these fields are populated:
- `name` — matches the project
- `version` — matches the latest tag
- `description` — present and professional
- `author` — present
- `license` — matches the LICENSE file
- `repository` — points to the correct GitHub URL

### Step 17 — Generate the seal report

After completing all steps, create an artifact summarizing:
- Date of seal
- Git SHA of `main` at time of seal
- Latest tag/release
- Branch count (local + remote)
- CI status
- Any items that were fixed during this run
- Any items deferred for future attention

Save as `seal_audit.md` in the conversation artifacts.

---

## Completion Criteria

The repository is **sealed** when ALL of the following are true:

| Criterion | Status |
|-----------|--------|
| LICENSE file present and current | ✅ |
| README is comprehensive | ✅ |
| CHANGELOG is maintained | ✅ |
| No committed secrets | ✅ |
| Stale branches cleaned | ✅ |
| Tags follow semver | ✅ |
| About section is complete | ✅ |
| Branch protection is configured | ✅ |
| CI pipeline is green | ✅ |
| Build succeeds locally | ✅ |
| Tests pass | ✅ |
| package.json metadata is complete | ✅ |

> **When all criteria are met, the repo is sealed.** 🔒
> Commit any changes made during this workflow with: `chore(seal): final 1% polish — <date>`
