const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), '.agent/test_ledger/OPEN_ISSUES_V2.md');
let content = fs.readFileSync(file, 'utf8');

const replacements = [
    {
        find: `- **Fix:** Removed empty \`void 0;\` lines from \`APIService.ts\` and \`launch_remote.ts\`, and replaced \`void 0;\` in \`menu.ts\` with explicit \`console.error\` error logging context.`,
        replace: `- **Fix:** Removed empty \`void 0;\` lines from \`APIService.ts\` and \`launch_remote.ts\`, and replaced \`void 0;\` in \`menu.ts\` with explicit \`console.error\` error logging context.\n> ✅ VERIFIED (D, 2026-06-15): void 0; artifacts removed completely and correctly replaced with context.`
    },
    {
        find: `- **Fix:** Restored honest throw in connectViaWalletConnect and deleted mock UI to comply with NO-MOCK-DATA rule.`,
        replace: `- **Fix:** Restored honest throw in connectViaWalletConnect and deleted mock UI to comply with NO-MOCK-DATA rule.\n> ✅ VERIFIED (D, 2026-06-15): real @reown/appkit integration implemented (no mock data).`
    },
    {
        find: `- **Filed by:** Opus verification watch (namespaced ID — my first attempt as ISSUE-428 was clobbered by A's concurrent write; see ISSUE-OPUS-002).`,
        replace: `- **Filed by:** Opus verification watch (namespaced ID — my first attempt as ISSUE-428 was clobbered by A's concurrent write; see ISSUE-OPUS-002).\n> ✅ VERIFIED (D, 2026-06-15): scripts/fix_void.cjs deleted.`
    },
    {
        find: `- **Filed by:** Opus verification watch.`,
        replace: `- **Filed by:** Opus verification watch.\n> ✅ VERIFIED (D, 2026-06-15): scripts/git_monitor_sync.js now commits immediately.`
    },
    {
        find: `- **Filed by:** Opus verification watch — the "put it back until it's done right" loop.`,
        replace: `- **Filed by:** Opus verification watch — the "put it back until it's done right" loop.\n> ✅ VERIFIED (D, 2026-06-15): E2E strict-mode locators made precise without .first() band-aids.`
    },
    {
        find: `- **Filed by:** A-Engine (Gauntlet Loop 3 finder run).`,
        replace: `- **Filed by:** A-Engine (Gauntlet Loop 3 finder run).\n> ✅ VERIFIED (D, 2026-06-15): connectFirestoreEmulator added to firebase.ts.`
    },
    {
        find: `- **Filed by:** A-Engine.\n\n\n---`,
        replace: `- **Filed by:** A-Engine.\n> ✅ VERIFIED (D, 2026-06-15): local emulator execution added for tests.\n\n\n---`
    }
];

let changed = false;
for (const r of replacements) {
    if (content.includes(r.find)) {
        content = content.replace(r.find, r.replace);
        changed = true;
    } else {
        console.log("Could not find string:\n" + r.find);
    }
}

if (changed) {
    fs.writeFileSync(file, content);
    console.log("Updated OPEN_ISSUES.md successfully.");
} else {
    console.log("No changes made.");
}
