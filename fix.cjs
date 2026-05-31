const fs = require('fs');
const path = './packages/renderer/src/services/agent/fine-tuned-models.ts';
let code = fs.readFileSync(path, 'utf8');
code = code.replace(
  "const isE2E = (typeof window !== 'undefined' && window.location?.search.includes('e2e=true')) || (typeof process !== 'undefined' && process.env.VITE_PLAYWRIGHT_E2E === 'true');",
  "const isE2E = (typeof window !== 'undefined' && window.location?.search.includes('e2e=true')) || import.meta.env.VITE_PLAYWRIGHT_E2E === 'true';"
);
fs.writeFileSync(path, code);

const issuePath = './.agent/test_ledger/OPEN_ISSUES.md';
let issues = fs.readFileSync(issuePath, 'utf8');
issues = issues.replace(
  "### ISSUE-054: E2E Fallback Fails Due to Undefined Process Env in Browser\n- **Status:** 🔵 OPEN",
  "### ISSUE-054: E2E Fallback Fails Due to Undefined Process Env in Browser\n- **Status:** ✅ FIXED (commit: pending)\n- **Fix:** Switched process.env access to import.meta.env for VITE_PLAYWRIGHT_E2E in pure browser environments.\n- **Files:** `packages/renderer/src/services/agent/fine-tuned-models.ts`"
);
fs.writeFileSync(issuePath, issues);
console.log('Fixed files');
