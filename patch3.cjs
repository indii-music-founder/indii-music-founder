const fs = require('fs');
const p = 'packages/firebase/src/functions/orchestration/inngest.ts';
let code = fs.readFileSync(p, 'utf8');

code = code.replace(
  "import { Inngest } from 'inngest';",
  "import { Inngest } from 'inngest';\nimport { Resend } from 'resend';\nimport { defineSecret } from 'firebase-functions/params';\n\nconst resendApiKey = defineSecret('RESEND_API_KEY');\n\nfunction getResendApiKey() {\n  const envKey = process.env.RESEND_API_KEY;\n  if (envKey) return envKey;\n  try { return resendApiKey.value(); } catch (e) { return ''; }\n}\n\nasync function sendEmail(email, subject, html) {\n  const apiKey = getResendApiKey();\n  if (!apiKey) {\n    console.warn('[Inngest] RESEND_API_KEY not found. Skipping email send.');\n    return;\n  }\n  const resend = new Resend(apiKey);\n  await resend.emails.send({\n    from: process.env.RESEND_FROM_EMAIL || 'indii <hello@indii.music>',\n    to: email,\n    subject,\n    html\n  });\n}\n"
);

code = code.replace(
  "// Integration with email service (SendGrid, etc.)",
  "await sendEmail(email, 'Welcome to indii!', '<p>Welcome to indii. Let us make some music!</p>');"
);

code = code.replace(
  "console.log(`[Inngest] Sending resources email to ${email}`);\n    });",
  "console.log(`[Inngest] Sending resources email to ${email}`);\n      await sendEmail(email, 'Resources for getting started', '<p>Here are some resources to get you started.</p>');\n    });"
);

code = code.replace(
  "// Send re-engagement email\n      }",
  "await sendEmail(email, 'We miss you at indii', '<p>Come back and make some tracks!</p>');\n      }"
);

fs.writeFileSync(p, code);
