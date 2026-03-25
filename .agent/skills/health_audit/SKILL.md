---
name: health-audit
version: 1.1.0
description: |
  Full-spectrum engineering health audit for indiiOS. Scans build health,
  tests, module completeness, service layer, agent fleet, security posture,
  dependencies, CI/CD, and tech debt. Produces a ship readiness report
  with prioritized action items. Self-upgrading: appends new scan
  dimensions discovered during runs.
  Use when asked to "audit the code", "health check", "ship readiness",
  "what's the state of the codebase", or "what needs to get finished".
---

# indiiOS Health Audit

Comprehensive engineering health and ship readiness audit. Run from the
project root. Produces an artifact report with prioritized action items.

## Preamble

```bash
cd "$(git rev-parse --show-toplevel 2>/dev/null)"
echo "PROJECT: $(basename $(pwd))"
echo "BRANCH: $(git branch --show-current)"
echo "HEAD: $(git rev-parse --short HEAD)"
echo "VERSION: $(cat VERSION 2>/dev/null || cat package.json | python3 -c 'import sys,json;print(json.load(sys.stdin).get(\"version\",\"unknown\"))' 2>/dev/null || echo unknown)"
```

## Scan Dimensions

Run all scans in parallel where possible. Each scan outputs structured
data that feeds the final report.

### 1. Build Health

```bash
echo "=== TYPECHECK ==="
npx tsc --noEmit 2>&1 | tail -5
echo "EXIT: $?"
```

### 2. Lint Health

```bash
echo "=== LINT ==="
npx eslint . --ext .ts,.tsx 2>&1 | tail -5
echo "EXIT: $?"
```

### 3. Test Health

```bash
echo "=== TESTS ==="
npx vitest run --reporter=verbose 2>&1 | tail -30
```

Classify failures as in-branch vs pre-existing vs external (non-app files).

### 4. Module Completeness

```bash
echo "=== MODULES ==="
for dir in src/modules/*/; do
  mod=$(basename "$dir")
  count=$(find "$dir" -name "*.tsx" -o -name "*.ts" | wc -l | tr -d ' ')
  lines=$(find "$dir" -name "*.tsx" -o -name "*.ts" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
  if [ "$count" -le 2 ]; then status="STUB"; else status="OK"; fi
  echo "$mod: $count files, $lines lines [$status]"
done
```

### 5. Service Layer

```bash
echo "=== SERVICES ==="
for dir in src/services/*/; do
  svc=$(basename "$dir")
  count=$(find "$dir" -name "*.ts" | wc -l | tr -d ' ')
  echo "$svc: $count files"
done
echo "Total exports: $(grep -rn '^export ' src/services/ --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')"
```

### 6. Agent Fleet

```bash
echo "=== AGENTS ==="
for dir in agents/*/; do
  agent=$(basename "$dir")
  has_prompt=$([ -f "$dir/prompt.md" ] && echo "Y" || echo "N")
  echo "$agent: prompt=$has_prompt"
done
echo "=== TRAINING DATA ==="
find docs/agent-training -name "*.jsonl" 2>/dev/null | while read f; do
  count=$(wc -l < "$f" | tr -d ' ')
  echo "$(basename $f): $count examples"
done | sort -t: -k2 -rn
```

### 7. Security

```bash
echo "=== SECURITY ==="
# Hardcoded secrets
grep -rn "sk-\|sk_live\|sk_test\|ghp_\|AIza" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v ".test." | grep -v "MOCK_KEY\|process.env\|import.meta.env\|example\|placeholder\|REDACTED\|FAKE"
# Console leaks
echo "Console statements: $(grep -rn 'console\.\(log\|warn\|error\)' src/ --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v '.test.' | wc -l | tr -d ' ')"
# Localhost refs
grep -rn "localhost:" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v ".test." | grep -v node_modules | head -10
```

### 8. Dependencies

```bash
echo "=== DEPS ==="
npm audit --json 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
meta=d.get('metadata',{})
vulns=meta.get('vulnerabilities',{})
print(f'critical: {vulns.get(\"critical\",0)}')
print(f'high: {vulns.get(\"high\",0)}')
print(f'moderate: {vulns.get(\"moderate\",0)}')
print(f'low: {vulns.get(\"low\",0)}')
" 2>/dev/null || echo "audit unavailable"
npm outdated 2>/dev/null | head -15
```

### 9. CI/CD

```bash
echo "=== CI/CD ==="
ls .github/workflows/ 2>/dev/null
gh run list --workflow=deploy.yml --limit=3 2>/dev/null || echo "gh unavailable"
```

### 10. Tech Debt

```bash
echo "=== TECH DEBT ==="
echo "TODOs: $(grep -rn 'TODO\|FIXME\|HACK\|XXX' src/ --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')"
echo "Zombie code: $(grep -rn '^// import\|^// const\|^// export' src/ --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')"
```

## Report Generation

After all scans complete, produce a markdown artifact at:

```
{artifact_dir}/indiios_health_report.md
```

The report MUST include:

1. **Executive Summary** — table with grades per dimension
2. **Per-dimension details** — raw data + analysis
3. **Prioritized Action Items** — P0 (must fix), P1 (should fix), P2 (nice to have)
4. **Ship Readiness Verdict** — clear yes/no/conditional with rationale

## Self-Upgrade Protocol

After each audit run, check if any NEW scan dimension was discovered
during the session (e.g., a new config file type found, a new test
framework detected, a new deployment target identified). If so:

1. Append the new scan to this SKILL.md under `## Scan Dimensions`
2. Increment the version patch number in the frontmatter
3. Log the upgrade:

```bash
echo "SKILL_UPGRADE: health-audit v$(date +%Y%m%d) added dimension: {NAME}" >> ~/.gstack/analytics/skill-upgrades.jsonl
```

This makes the skill learn from every run.

## Usage

Invoke with `/health-audit` or when asked about codebase health,
ship readiness, or "what needs to get finished."
