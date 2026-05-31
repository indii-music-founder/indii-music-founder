const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4242/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000); 
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

  await page.evaluate(async () => {
    localStorage.clear();
    localStorage.setItem('FIREBASE_E2E_MOCK', 'true');
    window.isFirebaseE2EMockEnabled = true;
    const store = window.useStore.getState();
    store.clearAgentHistory();
    store.setEntryAssistantDismissed(true);
    
    // Inject a chat message with an attachment!
    store.addAgentMessage({
      id: 'msg-with-art',
      role: 'user',
      text: 'Here is the album art we just generated.',
      timestamp: Date.now() - 10000,
      attachments: [{
          mimeType: 'image/png',
          base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      }]
    });

    store.setConversationMode('direct');
    store.setDirectTargetAgentId('creative');
  });

  await page.waitForTimeout(1000);

  console.log('Dispatching message to Creative Director directly...');
  await page.evaluate(async () => {
      const agentServiceModule = await import('/src/services/agent/AgentService.ts');
      const agentService = agentServiceModule.agentService;
      await agentService.sendMessage('Can you take a look at the album art we just generated?', undefined, 'creative');
  });

  console.log('Submitted prompt. Waiting for response...');

  let responseMessage = null;
  for (let i = 0; i < 30; i++) {
     await page.waitForTimeout(1000);
     responseMessage = await page.evaluate(() => {
        const store = window.useStore.getState();
        const messages = store.agentHistory || [];
        const modelMsgs = messages.filter(m => m.role === 'model' && !m.text.startsWith('*('));
        return modelMsgs.length > 0 ? modelMsgs[modelMsgs.length - 1] : null;
     });
     if (responseMessage) {
        break;
     }
  }

  console.log('--- FINAL RESPONSE MESSAGE ---');
  console.log(responseMessage);
  console.log('------------------------');
  
  await browser.close();
})();
