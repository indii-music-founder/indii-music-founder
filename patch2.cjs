const fs = require('fs');
const p = 'packages/firebase/src/email/sendEmail.ts';
let code = fs.readFileSync(p, 'utf8');
code = code.replace(
  "from: 'indii <onboarding@resend.dev>',  // Use verified domain in production",
  "from: process.env.RESEND_FROM_EMAIL || 'indii <onboarding@indii.music>',"
);
fs.writeFileSync(p, code);
