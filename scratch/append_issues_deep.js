import fs from 'fs';

const openIssuesContent = `
---

### ISSUE-021: Syntax error in CharacterLibrary.tsx (false positive?)
- **Status:** OPEN
- **Severity:** 🔴 CRITICAL
- **UX Dimension:** Build Stability
- **Module:** Creative Director
- **Found:** 2026-05-02 by Detroit Producer (Deep Test)
- **Steps to Reproduce:**
  1. The subagent reported a syntax error (duplicate key/missing comma).
  2. Typecheck passed. Need to verify if this is an actual issue or subagent hallucination.
- **Notes:** Check Vite HMR logs or module resolution if this occurs again.

---

### ISSUE-022: Brand Interview Tab Content Lag
- **Status:** OPEN
- **Severity:** 🟡 MEDIUM
- **UX Dimension:** UI/UX Polish
- **Module:** Brand Manager
- **Found:** 2026-05-02 by Detroit Producer (Deep Test)
- **Steps to Reproduce:**
  1. Navigate to Brand Manager.
  2. Switch tabs rapidly to Brand Interview.
  3. Header updates to "Brand Interview" but body remains on "Visual DNA" until clicked again.
- **Notes:** Likely a React state race condition or missing \`key\` prop causing a render bail.

---

### ISSUE-023: Global State Loss on Page Reload
- **Status:** OPEN
- **Severity:** 🔴 HIGH
- **UX Dimension:** State Persistence
- **Module:** Brand Manager
- **Found:** 2026-05-02 by Detroit Producer (Deep Test)
- **Steps to Reproduce:**
  1. Fill out Bio, Vibes, and Social URLs.
  2. Perform a hard browser reload (F5 / Cmd+R).
  3. Observe that all entered data is lost.
- **Notes:** Needs a persistence layer (Zustand persist middleware, IndexedDB, or Firebase) for global data.

---

### ISSUE-024: Vite Module Resolution Failure on Reload
- **Status:** OPEN
- **Severity:** 🔴 CRITICAL
- **UX Dimension:** System Stability
- **Module:** Global
- **Found:** 2026-05-02 by Detroit Producer (Deep Test)
- **Steps to Reproduce:**
  1. Perform a hard browser reload.
  2. System occasionally crashes with a Vite chunk resolution failure.
- **Notes:** Check \`vite.config.ts\` chunking strategy or circular dependencies.
`;

const historyContent = `
## 2026-05-02 - Detroit Producer - Universal Deep-Interaction Stress Test
- **Modules Tested:** Dashboard, Brand Manager, Creative Director, Boardroom
- **Duration:** 17 minutes
- **Findings:** 2 CRITICAL, 1 HIGH, 1 MEDIUM
- **Key Issues:** Global state lost on reload, Vite resolution failure on reload, UI lag on tabs.
- **UX Score:** NO-GO for Demo
`;

fs.appendFileSync('.agent/test_ledger/OPEN_ISSUES.md', openIssuesContent);
fs.appendFileSync('.agent/test_ledger/REAL_TEST_HISTORY.md', historyContent);

console.log('Appended to files');
