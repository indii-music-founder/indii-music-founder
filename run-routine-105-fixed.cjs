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
    
    // Simulate previously generated image in history
    store.addToHistory({
      id: 'fake-art-123',
      type: 'image',
      url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      prompt: 'A beautiful album art cover',
      timestamp: Date.now(),
      projectId: store.currentProjectId || 'default'
    });
    
    store.setConversationMode('direct');
    store.setDirectTargetAgentId('creative');
  });

  await page.waitForTimeout(1000);

  console.log('Dispatching message to Creative Director...');
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
