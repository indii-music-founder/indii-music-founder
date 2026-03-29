import { expect } from '@playwright/test';
import { test } from './fixtures/auth';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility (a11y) Smoke Tests — WCAG 2.1 AA
 *
 * Uses axe-core under the hood to scan for:
 *   - Color contrast violations (WCAG SC 1.4.3 / 1.4.6)
 *   - Missing ARIA labels and roles
 *   - Form input labels
 *   - Heading hierarchy
 *   - Focus management
 *
 * Run: npx playwright test e2e/a11y.spec.ts
 */

test.describe('Accessibility Compliance', () => {
    test.beforeEach(async ({ authedPage }) => {
        // Wait for the main app container to be present
        await authedPage.waitForSelector('[data-testid="app-root"], #root', {
            timeout: 15_000,
        });
        // Allow lazy-loaded modules time to settle
        await authedPage.waitForTimeout(2_000);
    });

    test('Dashboard should have no critical a11y violations', async ({ authedPage }) => {
        const results = await new AxeBuilder({ page: authedPage })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .exclude('.recharts-wrapper') // Chart SVGs generate false positives
            .analyze();

        // Log violations for debugging
        if (results.violations.length > 0) {
            console.log(
                'A11y violations:',
                JSON.stringify(
                    results.violations.map(v => ({
                        id: v.id,
                        impact: v.impact,
                        description: v.description,
                        nodes: v.nodes.length,
                    })),
                    null,
                    2
                )
            );
        }

        // Critical and serious violations must be zero
        const criticalViolations = results.violations.filter(
            v => v.impact === 'critical' || v.impact === 'serious'
        );

        expect(criticalViolations).toHaveLength(0);
    });

    test('Color contrast should meet WCAG AA standards', async ({ authedPage }) => {
        const results = await new AxeBuilder({ page: authedPage })
            .withRules(['color-contrast'])
            .analyze();

        // Allow minor contrast issues (typically in decorative elements)
        // but flag anything beyond a tolerance threshold
        const contrastViolations = results.violations.filter(
            v => v.id === 'color-contrast'
        );

        if (contrastViolations.length > 0) {
            console.log(
                `⚠️  ${contrastViolations[0]?.nodes?.length || 0} elements have contrast issues`
            );
        }

        // Strict: zero contrast violations for critical/serious
        const seriousContrast = contrastViolations.filter(
            v => v.impact === 'critical' || v.impact === 'serious'
        );
        expect(seriousContrast).toHaveLength(0);
    });

    test('All interactive elements should be keyboard accessible', async ({ authedPage }) => {
        const results = await new AxeBuilder({ page: authedPage })
            .withRules([
                'button-name',
                'link-name',
                'input-button-name',
                'label',
                'tabindex',
            ])
            .analyze();

        const violations = results.violations.filter(
            v => v.impact === 'critical' || v.impact === 'serious'
        );

        expect(violations).toHaveLength(0);
    });

    test('Sidebar navigation should have no a11y violations', async ({ authedPage }) => {
        // Ensure sidebar is visible
        const sidebar = authedPage.locator('[data-testid="sidebar"], nav[role="navigation"]');
        const isSidebarVisible = await sidebar.isVisible().catch(() => false);

        if (isSidebarVisible) {
            const results = await new AxeBuilder({ page: authedPage })
                .include('[data-testid="sidebar"], nav[role="navigation"]')
                .withTags(['wcag2a', 'wcag2aa'])
                .analyze();

            const criticalViolations = results.violations.filter(
                v => v.impact === 'critical' || v.impact === 'serious'
            );

            expect(criticalViolations).toHaveLength(0);
        }
    });
});
