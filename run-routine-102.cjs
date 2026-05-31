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
    
    // Set Boardroom mode to seat the agents
    store.setModule('boardroom');
    store.setConversationMode('boardroom');
    store.activeAgents.forEach(id => store.removeActiveAgent(id));
    store.addActiveAgent('finance');
    store.addActiveAgent('brand');

    // Wait for state to settle
    await new Promise(r => setTimeout(r, 500));

    // Force "direct" mode and target "generalist" (Conductor)
    store.setConversationMode('direct');
    store.setDirectTargetAgentId('generalist');

    // Manually trigger the prompt from window if possible, or we will just use the DOM
  });

  await page.waitForTimeout(1000);

  // Use evaluate to run the agent directly!
  console.log('Dispatching message to Conductor directly...');
  await page.evaluate(async () => {
      // Find the imported agentService
      const agentServiceModule = await import('/src/services/agent/AgentService.ts');
      const agentService = agentServiceModule.agentService;
      await agentService.sendMessage('Get the Legal Director to review our contract.', undefined, 'generalist');
  });

  console.log('Submitted prompt. Waiting for Conductor response...');

  let responseMessage = null;
  for (let i = 0; i < 30; i++) {
     await page.waitForTimeout(1000);
     responseMessage = await page.evaluate(() => {
        const store = window.useStore.getState();
        // Since we are in direct mode, the response goes to agentHistory
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
