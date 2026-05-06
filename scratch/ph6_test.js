import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  
  console.log('Navigating to http://localhost:4243...');
  await page.goto('http://localhost:4243');
  
  try {
    await page.waitForSelector('text=Explore as Guest', { timeout: 5000 });
    await page.click('text=Explore as Guest');
  } catch (e) {}
  
  await page.waitForTimeout(5000);
  
  // 1. Finance Verification
  console.log('Navigating to Finance Department via test-id...');
  const financeBtn = page.getByTestId('nav-item-finance');
  if (await financeBtn.isVisible()) {
    await financeBtn.click();
    await page.waitForTimeout(8000); // Give it more time to load charts
    
    // Check for "Aggregate Revenue" or "Overview"
    const revenueWidget = page.getByText(/Aggregate Revenue/i).first();
    if (await revenueWidget.isVisible()) {
        console.log('Finance: Aggregate Revenue widget found.');
    } else {
        console.log('Finance: Aggregate Revenue widget NOT found.');
    }
    
    await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/indiiOS-Clean/ph6_finance_detail.png', fullPage: true });
  } else {
    console.log('Finance button NOT found in sidebar.');
  }

  // 2. Social Feed Verification
  console.log('Navigating to Social Media Department via test-id...');
  const socialBtn = page.getByTestId('nav-item-social');
  if (await socialBtn.isVisible()) {
    await socialBtn.click();
    await page.waitForTimeout(5000);
    
    // Click Announce Drop
    console.log('Testing Announce Drop shortcut...');
    const dropButton = page.getByText(/Announce Drop/i).first();
    if (await dropButton.isVisible()) {
        await dropButton.click();
        await page.waitForTimeout(1000);
        const composerText = await page.locator('textarea').inputValue();
        if (composerText.includes('New Drop Alert')) {
            console.log('Shortcut applied correctly.');
        }
    }
    
    // Open Product Picker
    console.log('Opening Product Picker...');
    await page.locator('button:has(svg.lucide-shopping-bag)').click();
    await page.waitForTimeout(2000);
    
    // Check if Modal is open
    const modalTitle = page.getByText(/Attach Social Drop/i);
    if (await modalTitle.isVisible()) {
        console.log('Product Picker Modal opened.');
        
        // Select first product if any
        const firstProduct = page.locator('button.group').first();
        if (await firstProduct.isVisible()) {
            console.log('Selecting first product...');
            await firstProduct.click();
            await page.getByText('Done').click();
            await page.waitForTimeout(1000);
            
            // Verify attachment in composer
            const attachment = page.locator('div').filter({ hasText: /units left/i });
            if (await attachment.isVisible()) {
                console.log('Product attached to post draft.');
            }
        } else {
            console.log('No products found in picker.');
            await page.getByText('Done').click();
        }
    }
    
    await page.screenshot({ path: '/Volumes/X SSD 2025/Users/narrowchannel/indiiOS-Clean/ph6_social_final.png', fullPage: true });
  }

  await browser.close();
})();
