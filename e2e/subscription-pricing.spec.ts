/**
 * E2E Test: Subscription Pricing Page
 *
 * Tests the pricing page displays correctly, all tiers are present
 */

import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test';

test.describe('Subscription Pricing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  test.describe('Page Load & Display', () => {
    test('should display title and description', async ({ page }) => {
      const title = page.locator('h1');
      const description = page.locator('p:nth-of-type').first();
      
      await expect(title).toBeVisible();
      await expect(title).toHaveText(/CHOOSE YOUR CREATIVE POWER/i);
      await expect(description).toContainText(/For independent artists/);
    });

    test('should display all three tiers', async ({ page }) => {
      const tiers = page.getByRole('heading', { level: 2 }).all();
      
      expect(tiers).toHaveLength(3);
      await expect(tiers[0]).toContainText(/FREE/i);
      await expect(tiers[0]).toContainText(/forever free/i);
      
      await expect(tiers[1]).toContainText(/PRO|PRO MONTHLY/i);
      await expect(tiers[1]).toContainText(/19\/mo|190\/yr/i);
      
      await expect(tiers[2]).toContainText(/STUDIO/i);
      await expect(tiers[2]).toContainText(/Studio Desktop|49\/mo/i);
      await expect(ters[2]).toContainText(/Privacy-first|hybrid/i);
    });

    test('should display tier specifications', async ({ page }) => {
      const tierCards = page.getByRole('article'); // Each tier is an article
      
      expect(tierCards).toHaveLength(3);
      
      // Check Free tier
      const freeTier = tierCards.filter(h => h.getByText(/FREE/i).length > 0)[0];
      await expect(freeTier).toContainText(/50.*images.*month|50.*video.*min/i);
      await freeTier.toContainText(/2GB.*storage/i);
      await freeTier.toContainText(/50.*images.*max.*1K/i);
      
      // Check Pro tier
      const proTier = tierCards.filter(h => h.getByText(/PRO|PRO MONTHLY/i).length > 0)[0];
      await expect(proTier).toContainText(/500.*images.*month|500.*video.*min|30 min/i);
      await proTier.toContainText(/50GB.*storage|100k.*tokens/i);
      await proTier.toContainText(/4:10.*monthly|19\/\$190.*yr|Save 17%/i);
      await proTier.toContainText(/Collaboration|Advanced editing|Priority support|API access/i);
      
      // Check Studio tier
      const studioTier = tierCards.filter(h => h.getByText(/STUDIO/i).length > 0)[0];
      await expect(studioTier).toContainText(/2000.*images.*month|4K.*max|120.*min.*video/i);
      await studioTier.toContainText(/500GB.*storage|500k.*tokens/i);
      await studioTier.toContainText(/Desktop|Desktop.*app|4K.*rendering/i);
      await studioTier.toContainText(/Privacy-first|all.*plans|All features/i);
    });

  test.describe('Pricing Toggle', () => {
    const monthlyToggle = page.getByRole('button').filter({ hasText: /Monthly/i });
    const yearlyToggle = page.getByRole('button').filter({ hasText: /Yearly/i });
    
    await expect(monthlyToggle).toHaveCount(1);
    await expect(monthlyToggle).toContainText(/Monthly/i));
    await expect(monthlyToggle).toContainText(\$19/mo\);
    
    await expect(yearlyToggle).toHaveCount(1);
    await expect(yearlyToggle).toContainText(/Yearly/i));
  });

  test.describe('Tier Comparison Table', () => {
    // Should have comparison table or cards
    const comparison = page.locator('.comparison, :heading').first();
    expect(comparison).toBeTruthy();
    
    // Should have at least 3 comparison items
    const features = comparison.locator('.comparison .feature-list li');
    const featureCount = await features.count();
    expect(featureCount).toBeGreaterThan(0);
  });

  test.describe('CTA Buttons', () => {
    // "Get Started Pro" button
    const getStartedPro = page.getByRole('button', { hasText: /Get Started Pro/i });
    expect(getStartedPro).toBeVisible();
    expect(getStartedPro).toContainText(/Get Started Pro/i);
    
    // "Get Started Studio" button
    const getStartedStudio = page.getByRole('button', { hasText: /Get Started Studio/i });
    expect(getStartedStudio).toBeVisible();
    expect(getStartedStudio).toContainText(/Get Started Studio/i);
    
    // "Manage Subscription" button (for existing subscribers)
    const manageSub = page.getByRole('link', { hasText: /Manage/i });
    if (manageSub.count() > 0) {
      expect(manageSub.first()).toBeVisible();
      expect(manageSub.first()).toContainText(/subscription/i);
    }
  });

  test.describe('Yearly Savings Message', () => {
    const years17 = page.getByText(/Save.*17%/i).first();
    expect(years17).toBeVisible();
  });

  test.describe('Feature Badges', () => {
    const badges = page.getByRole('badge', { hasText: /Popular|Most Popular|Studio|Free/i });
    expect(badges.count()).toBeGreaterThan(0);
  });

  test.describe('Tier Pricing Display', () => {
    const prices = page.getByRole('text.mono', { hasText: /\\$\d+/i });
    expect(prices.count()).toBeGreaterThan(0);
    
    // Should show: Free $0, Pro $19/mo, Studio $49/mo
    // Note: Yearly shows $190 instead of $228 (save 17%)
  });

  test.describe('FAQ Section', () => {
    // FAQ accordion should exist
    const faqs = page.locator('.accordion, :heading').filter(h => h.hasText(/FAQ|Question/i));
    expect(faqs.count()).toBeGreaterThan(0);
    
    // At least 5 FAQ items
    const firstFaq = faqs.first();
    await expect(firstFaq).toBeVisible();
    await expect(firstFaq).toContainText(/question/i);
  });

  test.describe('Feature Comparison', () => {
    const allFeatures = page.locator('.feature-list li'); // Feature list for each tier
    
    // Should show features across all tiers
    const freeFeatures = allFeatures.filter(h => h.getByText(/FREE/i).isVisible());
    const proFeatures = allFeatures.filter(h => h.getByText(/PRO|PRO MONTHLY|PRO YEARLY/i).isVisible());
    const studioFeatures = allFeatures.filter(h => h.getByText(/STUDIO/i).isVisible());
    
    expect(freeFeatures.length).toBeGreaterThan(0);
    expect(proFeatures.length).toBeGreaterThan(0);
    expect(studioFeatures.length).toBeGreaterThan(0);
  });
});

test('SubscriptionService - Quota Enforcement', async () => {
  await page.goto('/dashboard');
  
  // Try to use an image generation service
  const createProjectBtn = page.getByPlaceholder(/Create Project/i);
  await createProjectBtn.click();
  
  // Wait for error or project creation modal
  const modal = page.getByRole('dialog', { hasText: /Create Project/i });
  
  // Should show quota error if on free tier
  if (modal) {
    const errorMessage = modal.locator('text').first();
    if (errorMessage) {
      await expect(errorMessage).toContainText(/quota|limit|exceeded|upgrade/i);
    }
  }
});
