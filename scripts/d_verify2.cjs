const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), '.agent/test_ledger/OPEN_ISSUES.md');
let content = fs.readFileSync(file, 'utf8');

const r = {
    find: `- **Fix:** Restored honest throw in \`connectViaWalletConnect\` and deleted mock UI to comply with NO-MOCK-DATA rule.`,
    replace: `- **Fix:** Restored honest throw in \`connectViaWalletConnect\` and deleted mock UI to comply with NO-MOCK-DATA rule.\n> ✅ VERIFIED (D, 2026-06-15): real @reown/appkit integration implemented (no mock data).`
};

if (content.includes(r.find)) {
    content = content.replace(r.find, r.replace);
    fs.writeFileSync(file, content);
    console.log("Updated OPEN_ISSUES.md successfully.");
} else {
    console.log("Could not find string:\n" + r.find);
}
