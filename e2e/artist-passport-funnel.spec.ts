import { test, expect } from '@playwright/test';

/**
 * Playwright E2E Test Suite — Artist Passport Acquisition Funnel
 *
 * Verifies the full user acquisition journey:
 * 1. Entry at /passport with initial hero CTA
 * 2. 6-step diagnostic wizard completion
 * 3. Generation of deterministic gap analysis report
 * 4. Lead contact submission
 * 5. "Still not convinced" navigation to landing page
 * 6. Studio signup handoff with assessment claiming parameter
 */

const LANDING_URL = process.env.PLAYWRIGHT_LANDING_URL || 'http://localhost:3000';

test.describe('Artist Passport Acquisition Funnel', () => {
  test('completes diagnostic survey, generates gap report, and supports skeptical handoff', async ({ page }) => {
    // 1. Visit /passport
    await page.goto(`${LANDING_URL}/passport`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText(/How ready is your music/i);

    // 2. Click Start Free Business Audit
    const startButton = page.getByRole('button', { name: /Start Free Business Audit/i });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // 3. Step 1: Career Stage
    await expect(page.getByText(/Where are you currently in your music journey/i)).toBeVisible();
    await page.getByRole('button', { name: /Building momentum/i }).click();
    await page.getByRole('button', { name: /Next Step/i }).click();

    // 4. Step 2: Primary Genre
    await expect(page.getByText(/What is your primary musical lane/i)).toBeVisible();
    await page.getByRole('button', { name: /Electronic \/ Dance/i }).click();
    await page.getByRole('button', { name: /Next Step/i }).click();

    // 5. Step 3: Rights Registration (3A PRO + 3B MLC)
    await expect(page.getByText(/How are your songs registered/i)).toBeVisible();
    await page.getByRole('button', { name: /^ASCAP$/i }).click();
    await page.getByRole('button', { name: /not registered with The MLC/i }).click();
    await page.getByRole('button', { name: /Next Step/i }).click();

    // 6. Step 4: Distribution Partner & Next Release Status
    await expect(page.getByText(/How is your music distributed\?/i)).toBeVisible();
    await page.getByRole('button', { name: /^DistroKid$/i }).click();
    await page.getByRole('button', { name: /mixing or final mastering/i }).click();
    await page.getByRole('button', { name: /Next Step/i }).click();

    // 7. Step 5: Primary Priorities
    await expect(page.getByText(/What are your top 2 priorities right now/i)).toBeVisible();
    await page.getByRole('button', { name: /Improve royalty registration & collection tracking/i }).click();
    
    const generateButton = page.getByRole('button', { name: /Generate Assessment/i });
    await expect(generateButton).toBeVisible();
    await generateButton.click();

    // 8. Step 6: Diagnostic Report Generation
    await expect(page.getByText(/Your Artist Business Diagnostic/i)).toBeVisible();

    // Verify rights leakage warning detected for ASCAP without MLC
    await expect(page.getByText(/Possible Streaming Mechanical Collection Gap/i)).toBeVisible();

    // 9. Lead Contact Form Submission
    const nameInput = page.getByPlaceholder(/Your artist or producer name/i);
    const emailInput = page.getByPlaceholder(/your\.email@example\.com/i);

    if (await nameInput.isVisible()) {
      await nameInput.fill('Playwright Test Artist');
      await emailInput.fill('playwright-test@indii.music');

      const sendReportButton = page.getByRole('button', { name: /Save Email Copy/i });
      await sendReportButton.click();

      // Wait for confirmation message
      await expect(page.getByText(/Your assessment copy request is saved for/i)).toBeVisible({ timeout: 10_000 });
    }

    // 10. Check "Still Not Convinced? See Full Platform & Free Tools" button
    const skepticalLink = page.getByRole('link', { name: /Still Not Convinced\? See Full Platform & Free Tools/i });
    await expect(skepticalLink).toBeVisible();
    const href = await skepticalLink.getAttribute('href');
    expect(href).toContain('#studio-preview');

    // 11. Check "Claim Your Artist Passport" CTA (waits for async assessment persistence)
    const claimCta = page.getByRole('link', { name: /Claim Your Artist Passport & Enter Studio/i });
    await expect(claimCta).toBeVisible();
    await expect(claimCta).toHaveAttribute('href', /\/signup/);
    await expect(claimCta).toHaveAttribute('href', /assessmentId=/);
  });
});
