const fs = require('fs');
let webhookPath = 'packages/firebase/src/stripe/webhookHandler.ts';
let webhook = fs.readFileSync(webhookPath, 'utf8');

const webhookRoute = `
  if (session.metadata?.type === 'founder_pass') {
    await handleFounderPassCheckoutCompleted(session);
    return;
  }`;

webhook = webhook.replace(webhookRoute, '');
webhook = webhook.replace('  // Route founder pass payments separately\n', '');

fs.writeFileSync(webhookPath, webhook);
