cd "/Volumes/X SSD 2025/Users/narrowchannel/Desktop/indii-music-founder"

echo "=== PREAMBLE ==="
echo "PROJECT: $(basename $(pwd))"
echo "BRANCH: $(git branch --show-current)"
echo "HEAD: $(git rev-parse --short HEAD)"
echo "VERSION: $(cat VERSION 2>/dev/null || cat package.json | python3 -c 'import sys,json;print(json.load(sys.stdin).get("version","unknown"))' 2>/dev/null || echo unknown)"

echo "=== TYPECHECK ==="
npx tsc --noEmit 2>&1 | tail -20
echo "EXIT: $?"

echo "=== LINT ==="
npx eslint . --ext .ts,.tsx 2>&1 | tail -20
echo "EXIT: $?"

echo "=== TESTS ==="
npx vitest run --reporter=verbose 2>&1 | tail -30

echo "=== MODULES ==="
for dir in packages/renderer/src/modules/*/; do
  if [ -d "$dir" ]; then
    mod=$(basename "$dir")
    count=$(find "$dir" -name "*.tsx" -o -name "*.ts" | wc -l | tr -d ' ')
    lines=$(find "$dir" -name "*.tsx" -o -name "*.ts" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}')
    if [ "$count" -le 2 ]; then status="STUB"; else status="OK"; fi
    echo "$mod: $count files, $lines lines [$status]"
  fi
done

echo "=== SERVICES ==="
for dir in packages/renderer/src/services/*/; do
  if [ -d "$dir" ]; then
    svc=$(basename "$dir")
    count=$(find "$dir" -name "*.ts" | wc -l | tr -d ' ')
    echo "$svc: $count files"
  fi
done
echo "Total exports: $(grep -rn '^export ' packages/renderer/src/services/ --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')"

echo "=== AGENTS ==="
for dir in agents/*/; do
  if [ -d "$dir" ]; then
    agent=$(basename "$dir")
    has_prompt=$(( [ -f "$dir/prompt.md" ] || [ -f "$dir/AGENTS.md" ] ) && echo "Y" || echo "N")
    echo "$agent: prompt=$has_prompt"
  fi
done
echo "=== TRAINING DATA ==="
find docs/agent-training -name "*.jsonl" 2>/dev/null | while read f; do
  count=$(wc -l < "$f" | tr -d ' ')
  echo "$(basename $f): $count examples"
done | sort -t: -k2 -rn

echo "=== SECURITY ==="
grep -rn "sk-\|sk_live\|sk_test\|ghp_\|AIza" packages/renderer/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v ".test." | grep -v "MOCK_KEY\|process.env\|import.meta.env\|example\|placeholder\|REDACTED\|FAKE"
echo "Console statements: $(grep -rn 'console\.\(log\|warn\|error\)' packages/renderer/src/ --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v '.test.' | wc -l | tr -d ' ')"
grep -rn "localhost:" packages/renderer/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v ".test." | grep -v node_modules | head -10

echo "=== DEPS ==="
npm audit --json 2>/dev/null | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  meta=d.get('metadata',{})
  vulns=meta.get('vulnerabilities',{})
  print(f'critical: {vulns.get(\"critical\",0)}')
  print(f'high: {vulns.get(\"high\",0)}')
  print(f'moderate: {vulns.get(\"moderate\",0)}')
  print(f'low: {vulns.get(\"low\",0)}')
except Exception as e:
  pass
" 2>/dev/null || echo "audit unavailable"
npm outdated 2>/dev/null | head -15

echo "=== CI/CD ==="
ls .github/workflows/ 2>/dev/null
gh run list --workflow=deploy.yml --limit=3 2>/dev/null || echo "gh unavailable"

echo "=== TECH DEBT ==="
echo "TODOs: $(grep -rn 'TODO\|FIXME\|HACK\|XXX' packages/renderer/src/ --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')"
echo "Zombie code: $(grep -rn '^// import\|^// const\|^// export' packages/renderer/src/ --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')"

echo "=== ANTI-AI SLOP ==="
echo "Placeholders: $(grep -rn '\.\.\. rest of code\|\.\.\. implementations here\|TODO.*implement' packages/renderer/src/ --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')"
echo "Boilerplate: $(grep -rn 'Here is the.*code\|As an AI' packages/renderer/src/ --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')"

