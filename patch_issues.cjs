const fs = require('fs');
const p = '.agent/test_ledger/OPEN_ISSUES.md';
let code = fs.readFileSync(p, 'utf8');

function fixIssue(issueNum, fixText) {
  const regex = new RegExp(`(### ISSUE-${issueNum}:.*?\\n- \\*\\*Status:\\*\\* )OPEN(\\n- \\*\\*Severity:\\*\\*.*?\\n- \\*\\*Location:\\*\\*.*?\\n- \\*\\*Details:\\*\\*.*?\\n)`, 's');
  code = code.replace(regex, `$1✅ FIXED$2- **Fix:** ${fixText}\n`);
}

fixIssue('228', 'Replaced Math.random mock slop with an unimplemented HttpsError for provider integrations.');
fixIssue('229', 'Duplicate of ISSUE-189.');
fixIssue('230', 'Replaced crypto.randomUUID() with a deterministic SHA256 hash of the event payload.');
fixIssue('231', 'Updated email sender to use process.env.RESEND_FROM_EMAIL or a fallback indii domain instead of a resend.dev placeholder.');
fixIssue('232', 'Replaced console.log placeholders with actual sendEmail calls using Resend SDK.');
fixIssue('233', 'Fetched the video from post.mediaUrl into a Buffer instead of appending the raw URL string to the multipart body.');

fs.writeFileSync(p, code);
