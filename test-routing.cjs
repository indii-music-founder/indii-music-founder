const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4242/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000); 
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('FIREBASE_E2E_MOCK', 'true');
    window.isFirebaseE2EMockEnabled = true;
    const store = window.useStore.getState();
    store.clearAgentHistory();
    store.setEntryAssistantDismissed(true);
    store.setConversationMode('boardroom');
    store.activeAgents.forEach(id => store.removeActiveAgent(id));
    store.addActiveAgent('finance');
    store.addActiveAgent('brand');
  });

  await page.waitForTimeout(1000);

  // Directly prompt Conductor:
  await page.getByTestId('main-prompt-input').fill('@conductor Get the Legal Director to review our contract.');
  await page.getByTestId('main-prompt-input').press('Enter');

  await page.waitForTimeout(5000);

  await browser.close();
})();
