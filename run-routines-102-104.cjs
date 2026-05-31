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
    
    // Set Boardroom mode and seat ONLY Finance Head and Brand Manager
    store.setConversationMode('boardroom');
    store.addActiveAgent('finance');
    store.addActiveAgent('brand');
    store.removeActiveAgent('orchestrator'); // Remove conductor if default seated
  });

  await page.waitForTimeout(1000);

  // --- Routine 102: Seated-Only Delegation Enforcement ---
  console.log('--- Routine 102: Dispatching message to Conductor... ---');
  await page.evaluate(async () => {
      const agentServiceModule = await import('/src/services/agent/AgentService.ts');
      const agentService = agentServiceModule.agentService;
      await agentService.sendMessage('Get the Legal Director to review our contract.', undefined, 'orchestrator');
  });

  console.log('Waiting for response...');

  let r102Response = null;
  for (let i = 0; i < 30; i++) {
     await page.waitForTimeout(1000);
     r102Response = await page.evaluate(() => {
        const store = window.useStore.getState();
        const messages = store.boardroomMessages || [];
        const modelMsgs = messages.filter(m => m.role === 'model' && !m.text.startsWith('*('));
        return modelMsgs.length > 0 ? modelMsgs[modelMsgs.length - 1] : null;
     });
     if (r102Response) break;
  }

  console.log('--- FINAL RESPONSE MESSAGE (102) ---');
  console.log(r102Response);
  console.log('------------------------');

  // --- Routine 103: Routine/Generalist Evaluation ---
  // "Ask the Conductor: "Please write a polite email to the venue asking for a later load-in time."
  await page.evaluate(async () => {
    const store = window.useStore.getState();
    store.clearAgentHistory();
    store.setConversationMode('direct');
    store.setDirectTargetAgentId('orchestrator');
  });

  await page.waitForTimeout(1000);
  console.log('--- Routine 103: Dispatching message to Conductor... ---');
  await page.evaluate(async () => {
      const agentServiceModule = await import('/src/services/agent/AgentService.ts');
      const agentService = agentServiceModule.agentService;
      await agentService.sendMessage('Please write a polite email to the venue asking for a later load-in time.', undefined, 'orchestrator');
  });

  console.log('Waiting for response...');

  let r103Response = null;
  for (let i = 0; i < 30; i++) {
     await page.waitForTimeout(1000);
     r103Response = await page.evaluate(() => {
        const store = window.useStore.getState();
        const messages = store.agentHistory || [];
        const modelMsgs = messages.filter(m => m.role === 'model' && !m.text.startsWith('*('));
        // Find if any specialist agent was invoked
        return modelMsgs.length > 0 ? modelMsgs[modelMsgs.length - 1] : null;
     });
     // Routine 103 expects the Orchestrator to just write the email directly (no delegation)
     if (r103Response) break;
  }

  console.log('--- FINAL RESPONSE MESSAGE (103) ---');
  console.log(r103Response);
  console.log('------------------------');

  // --- Routine 104: Deep Specialist Hand-off ---
  // "State: "We need a complete sync licensing agreement drafted for the new single 'Midnight Run'..."
  await page.evaluate(async () => {
    const store = window.useStore.getState();
    store.clearAgentHistory();
  });
  
  await page.waitForTimeout(1000);
  console.log('--- Routine 104: Dispatching message to Conductor... ---');
  await page.evaluate(async () => {
      const agentServiceModule = await import('/src/services/agent/AgentService.ts');
      const agentService = agentServiceModule.agentService;
      await agentService.sendMessage("We need a complete sync licensing agreement drafted for the new single 'Midnight Run'.", undefined, 'orchestrator');
  });

  let r104Response = null;
  for (let i = 0; i < 30; i++) {
     await page.waitForTimeout(1000);
     r104Response = await page.evaluate(() => {
        const store = window.useStore.getState();
        const messages = store.agentHistory || [];
        const modelMsgs = messages.filter(m => m.role === 'model' && !m.text.startsWith('*('));
        return modelMsgs.length > 0 ? modelMsgs[modelMsgs.length - 1] : null;
     });
     if (r104Response) break;
  }
  
  console.log('--- FINAL RESPONSE MESSAGE (104) ---');
  console.log(r104Response);
  console.log('------------------------');

  await browser.close();
})();
