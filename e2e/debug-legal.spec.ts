import { test } from './fixtures/auth';
test('debug legal timings', async ({ authedPage: page }) => {
  const start = Date.now();
  console.log(`[0s] Starting goto`);
  await page.goto('/legal', { waitUntil: 'domcontentloaded' });
  console.log(`[${(Date.now() - start)/1000}s] goto domcontentloaded finished`);
  
  await page.waitForSelector('[data-testid="app-container"]', { timeout: 15_000 });
  console.log(`[${(Date.now() - start)/1000}s] app-container found`);
  
  await page.waitForTimeout(2000);
  console.log(`[${(Date.now() - start)/1000}s] wait 2000 finished`);
});
