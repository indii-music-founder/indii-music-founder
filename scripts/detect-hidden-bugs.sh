#!/bin/bash
# HIDDEN BUG PATTERN DETECTOR
# Scans codebase for patterns that frequently cause silent failures
# Run weekly to catch emerging issues before they reach production

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🔍 HIDDEN BUG PATTERN DETECTOR"
echo "Scanning for 6 high-risk patterns..."
echo

# Pattern 1: Services exported as null (module init order bugs)
echo "1️⃣  MODULE INITIALIZATION ORDER"
echo "   Checking for services exported as null..."
PATTERN1=$(grep -r "export.*null.*as" packages/renderer/src/services --include="*.ts" 2>/dev/null | grep -v test | grep -v ".spec" | wc -l)
echo "   Found $PATTERN1 services exported as null"
if [ "$PATTERN1" -gt 0 ]; then
    echo "   ⚠️  RISK: If init fails, consumers get undefined"
    grep -r "export.*null.*as" packages/renderer/src/services --include="*.ts" | grep -v test | head -3 | sed 's/^/      /'
fi
echo

# Pattern 2: Base64 sent to APIs (payload validation bugs)
echo "2️⃣  BASE64 PAYLOAD VALIDATION"
echo "   Checking for Base64 data sent to APIs..."
PATTERN2=$(grep -r "imageBytes\|data:image" packages/renderer/src --include="*.ts" --include="*.tsx" \
    | grep -v test | grep -v ".spec" | grep -v "interface\|type\|function\|@" | wc -l)
echo "   Found $PATTERN2 instances of Base64/imageBytes usage"
if [ "$PATTERN2" -gt 5 ]; then
    echo "   ⚠️  RISK: Some may be sent to APIs (should use gs:// URIs instead)"
    grep -r "imageBytes.*=" packages/renderer/src/modules/creative --include="*.ts" --include="*.tsx" \
        | grep -v test | head -2 | sed 's/^/      /'
fi
echo

# Pattern 3: Unvalidated HTTP payloads
echo "3️⃣  HTTPCALLABLE PAYLOAD VALIDATION"
PATTERN3=$(grep -r "httpsCallable(functions" packages/renderer/src --include="*.ts" --include="*.tsx" \
    | grep -v test | grep -v ".spec" | wc -l)
echo "   Found $PATTERN3 httpsCallable uses"
echo "   ⚠️  Each one is a potential payload schema mismatch risk"
echo "   Top modules using httpsCallable:"
grep -r "httpsCallable(functions" packages/renderer/src/modules --include="*.tsx" --include="*.ts" \
    | grep -v test | cut -d/ -f5 | sort | uniq -c | sort -rn | head -5 | sed 's/^/      /'
echo

# Pattern 4: Unprotected async/await
echo "4️⃣  UNPROTECTED ASYNC OPERATIONS"
PATTERN4=$(grep -r "await.*httpsCallable\|await.*generate" packages/renderer/src \
    --include="*.tsx" --include="*.ts" | grep -v "try {" -B 2 | grep "await" | wc -l)
echo "   Found ~$PATTERN4 awaits without try-catch protection"
if [ "$PATTERN4" -gt 10 ]; then
    echo "   ⚠️  RISK: Unhandled promise rejections, silent failures"
    echo "   Unprotected await patterns:"
    grep -r "await " packages/renderer/src/modules/creative/hooks --include="*.ts" | head -3 | sed 's/^/      /'
fi
echo

# Pattern 5: Direct Firebase imports (tight coupling)
echo "5️⃣  FIREBASE SERVICE COUPLING"
PATTERN5=$(grep -r "import.*{.*functions" packages/renderer/src/modules --include="*.tsx" --include="*.ts" | wc -l)
echo "   Found $PATTERN5 modules importing Firebase functions directly"
echo "   ⚠️  If Firebase init fails, these modules will crash"
echo "   Modules importing functions:"
grep -r "from.*firebase/functions" packages/renderer/src/modules --include="*.tsx" --include="*.ts" \
    | cut -d/ -f5 | sort | uniq -c | sort -rn | head -5 | sed 's/^/      /'
echo

# Pattern 6: Missing error boundaries in async chains
echo "6️⃣  ASYNC ERROR HANDLING"
echo "   Checking for proper error handling in async chains..."
PATTERN6=$(grep -r "\.then(" packages/renderer/src/modules --include="*.tsx" --include="*.ts" | grep -v ".catch" | wc -l)
echo "   Found $PATTERN6 .then() calls without .catch()"
if [ "$PATTERN6" -gt 5 ]; then
    echo "   ⚠️  RISK: Unhandled promise rejections"
fi
echo

# Pattern 7: String enums vs proper enums
echo "7️⃣  ENUM VALIDATION"
echo "   Checking for string-based enum patterns..."
PATTERN7=$(grep -r "model\|aspectRatio\|resolution" packages/renderer/src/modules/creative/hooks \
    --include="*.ts" | grep "==\|===\|if.*===" | wc -l)
echo "   Found $PATTERN7 string comparisons for enum-like values"
if [ "$PATTERN7" -gt 5 ]; then
    echo "   ⚠️  RISK: Typos in string values (e.g., 'fast' vs 'FAST') can silently fail"
fi
echo

# Summary
echo "════════════════════════════════════════════"
echo "RISK SCORE: $(($PATTERN1 + ($PATTERN2/5) + ($PATTERN3/10) + ($PATTERN4/10) + $PATTERN5 + $PATTERN6 + $PATTERN7)) "
echo

if [ "$PATTERN1" -gt 0 ] || [ "$PATTERN2" -gt 10 ] || [ "$PATTERN4" -gt 15 ]; then
    echo "🚨 HIGH RISK PATTERNS DETECTED"
    echo "Recommended actions:"
    echo "  1. Review .agent/test_ledger/GENERATION_FAILURES.md for similar bugs"
    echo "  2. Run: npm run test:api -- to catch payload validation errors"
    echo "  3. Add integration tests for at-risk modules"
    exit 1
else
    echo "✅ Patterns under control"
    exit 0
fi
