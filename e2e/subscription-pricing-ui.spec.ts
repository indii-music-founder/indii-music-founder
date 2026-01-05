/**
 * E2E Test: Subscription Features - UI Only
 *
 * Tests the subscription pricing page and usage dashboard UI components
 */

import { test, expect } from '@playwright/test';

test.describe('Subscription Features - UI Only', () => {

  test.beforeEach(async ({ page }) => {
    // Try to go to pricing page
    try {
      await page.goto('/pricing');
    } catch (e) {
      console.error('Failed to navigate to pricing page:', e);
      test.skip('Failed to navigate to pricing page');
      return;
    }

    // Simple navigation
    console.log('Current URL:', await page.url());
  });

  describe('Pricing Page - UI Components', () => {

    // Main heading
    const title = page.locator('h1');
    await expect(title).toBeVisible();
    await expect(title).toHaveText(/CHOOSE YOUR CREATIVE POWER/i);
    await expect(title).toHaveText(/For independent artists|Choose Creative Power/i);

    // Subheading
    const subheading = page.locator('h2, { hasText: /Choose your creative power/i });
    await expect(subheading).toBeVisible();
    await expect(subheading).toContainText(/From hobbyist to powerhouse|From hobbyist to powerhouse/i);
  });

    // Description
    const desc = page.locator('p.mono', { hasText: /For independent artists|Choose your creative power/i });
    await expect(desc).toBeVisible();
    await expect(desc).toContainText(/For independent artists|Choose your creative power/i);
  });

  describe('Yearly Billing Toggle', () => {
    const toggles = page.locator('button', { hasText: /Yearly/i });
    
    if (toggles.length > 0) {
      const yearlyToggle = toggles.find(t => t.textContent().includes('Yearly'));
      
      await expect(yearlyToggle).toBeVisible();
      
      // Toggle should change "Save 17%" badge styling
      const yearlyBadge = yearlyToggle.locator('span');
      if (yearlyBadge.count() > 0) {
        await expect(yearlyBadge).toHaveAttribute('class', /text-yellow-500|text-yellow-500/);
        await expect(yearlyBadge).toHaveAttribute('class', /bg-yellow-500/20|'); // Dark bg bg when yellow
      }
    }
  });

  describe('Three Tier Cards', () => {
    // One card for each tier should exist
    const cards = page.locator('article');
    const tierNames = ['FREE', 'PRO', 'STUDIO'];
    
    await Promise.all(
      tierNames.map(async (tier => {
        const card = cards.find(h => h => h.textContent().includes(tier));
        if (!card) return;

        await expect(card).toBeVisible();
        
        // Card title and description (h1 and h2)
        const title = card.locator('h1, h2, header, p.mono');
        const desc = card.locator('p.mono');

        await Promise.all([
          title.map(el => el.waitForVisible(),
          desc.map(el => el.waitForVisible()
        ]);
      })
    });
  });

  describe('Tier Specifications', () => {
    // Get all specs
    const sections = page.locator('[data-testid="tier"] *:has\\(border)');
    const freeSpecs = sections.filter((_, idx) => idx === 0); // FREE tier

    expect(freeSpecs.length).toBeGreaterThan(0);

    const specContent = await freeSpecs.textContent();

    // Check for key FREE tier details
    expect(specContent).toContainText(/50.*images.*month|50.*images.*every|50.*images.*daily/i);
    expect(specContent).toContainText(/5.*min.*video|5.*min.*maximum|5.*max/i);
    expect(specContent).toContainText(/2GB.*storage|2GB.*total/i);
  });

  test.describe('Features Lists', () => {
    // Feature lists for each tier
    const featureLists = page.locator('ul.feature-list > 0, li');

    // Each tier should have a feature list
    expect(featureLists.length).toBe(3);

    // Test some sample features from each tier
    const allFeatures = featureLists.map(list => list.all());
    const features = await Promise.all(
      allFeatures.map(async (feature) => {
        if (await feature.isVisible().catch(() => true)) {
          return await feature.textContent();
        }
      })
    );

    // Check that different features exist
    expect(features).toContainText(/images|video|storage|collaboration/i));
    
    // Check pro-exclusive features
    const proFeatures = features.filter(f => f.toString().includes('Team|API Access|Priority|Advanced'));
    expect(proFeatures.length).toBeGreaterThan(0);
    
    // Check studio-exclusive features
    const studioFeatures = features.filter(f => f.toString().includes('Desktop|Privacy|Unlimited|Local'));
    expect(studioFeatures.length).toBeGreaterThan(0);
  });

  describe('Comparison Table', () => {
    // Should have comparison items across all tiers
    const comparisons = page.locator('.comparison > *:visible > 0');
    expect(comparisons.length).toBeGreaterThan(0);
  });

  describe('CTA Buttons', () => {
    // "Get Started Free" button (placeholder - doesn't exist in Free tier yet)
    // "Get Started Pro" button
    const getStartedPro = page.locator('a[href="/pricing"], text.mono, > 0');
    await expect(getStartedPro).toContainText(/Get Started Pro|Get Started Pro - \** 19\/mo|$228\/yr|Save 17%\*/i);

    // "Get Started Studio" button (shows on desktop variant)
    const getStartedStudio = page.locator('a[href="/pricing"], text.mono, > 0');
    await expect(getStartedStudio).toContainText(/Get Started Studio|Get Started Studio - \$49\/mo|Desktop|Studio Desktop|Privacy-first|Hybrid*/i);
  });

  describe('FAQ Section', () => {
    // FAQ accordion should exist
    const faqs = page.locator('.details', { hasText: /FAQ|Frequently Asked/i }).first();

    if (faqs) {
      // FAQ group should be visible
      const accordion = faqs.locator('details > div');
      expect(accordion).toBeVisible();

      // Each FAQ should have a header
      const header = accordion.locator('details > h3');
      await expect(header).toContainText(/question/i);

      // FAQ items should start collapsed
      const allAccordionItems = accordion.locator('details > li:visible=false');
      await Promise.all(
        allAccordionItems.map(async (item, idx) => {
          if (await item.locator(':visible=false').count() > 0) {
            await item.scrollIntoView();
          }
        })
      );
    }
  });

  describe('Upgrade Prompts', () => {
    // All CTA buttons should link to pricing page
    const pricingLinks = page.locator('a[href="/pricing"], text.mono, > 0');

    for (const link of pricingLinks) {
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', /pricing/i);
    }
  });

  describe('Platform-Specific Features', () => {
    // Studio tier should have desktop icon
    // Note: This may not show if running on web, so we'll make it conditional
    // Only check if page is still on pricing page
    const hasStudioUI = page.url().includes('/pricing') && /|pricing/.test/i.test;

    if (hasStudioUI) {
      // Check for Studio-specific elements
      const studioSection = page.locator('[data-testid="tier"][data-testid="studio-"]');

      if (studioSection.count() > 0) {
        const desktopIcon = studioSection.locator('[title*="Studio"] svg');
        if (desktopIcon.count() > 0) {
          await expect(desktopIcon.first()).toBeVisible();
          await expect(desktopIcon.first()).toHaveAttribute('hasText', /Studio/);
          
          if (page.locator('state') && page.locator('state').includes('studio')) {
            console.log('Studio UI is active');
          }
        }
      }
    }
  else {
      console.log('Not on pricing page, skipping platform check');
    }
  });

  test.afterEach(async ({ page }) => {
    console.log('Navigation ended at:', page.url());
  });
});
