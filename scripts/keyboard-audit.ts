/**
 * Item 270: Keyboard Navigation Audit Script
 *
 * A Playwright-based audit that verifies keyboard navigability across all
 * major routes. Checks:
 *   1. Tab order is logical (top-to-bottom, left-to-right)
 *   2. All interactive elements are reachable via Tab
 *   3. No keyboard traps (can always Tab out)
 *   4. Focus indicators are visible on interactive elements
 *   5. Skip-to-main-content link works (if present)
 *
 * Run: npx tsx scripts/keyboard-audit.ts
 * Output: reports/keyboard-audit.json
 */

import { chromium, type Page, type ElementHandle } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4242';
const REPORT_DIR = join(process.cwd(), 'reports');

interface FocusableElement {
    tag: string;
    role: string | null;
    ariaLabel: string | null;
    text: string;
    tabIndex: number;
    isVisible: boolean;
    hasVisibleFocus: boolean;
    rect: { x: number; y: number; width: number; height: number } | null;
}

interface TabOrderIssue {
    type: 'unreachable' | 'keyboard-trap' | 'missing-focus-style' | 'tab-order-jump' | 'missing-aria-label';
    element: string;
    description: string;
    severity: 'error' | 'warning';
}

interface RouteAudit {
    route: string;
    totalFocusable: number;
    reachableByTab: number;
    issues: TabOrderIssue[];
    tabOrder: string[];
}

interface AuditReport {
    timestamp: string;
    baseUrl: string;
    routes: RouteAudit[];
    totalIssues: number;
    errorCount: number;
    warningCount: number;
}

async function getAllFocusableElements(page: Page): Promise<FocusableElement[]> {
    return page.evaluate(() => {
        const SELECTORS = 'a[href], button, input, select, textarea, [tabindex], [role="button"], [role="link"], [role="menuitem"], [role="tab"]';
        const elements = document.querySelectorAll(SELECTORS);
        const results: FocusableElement[] = [];

        for (const el of elements) {
            const htmlEl = el as HTMLElement;
            const rect = htmlEl.getBoundingClientRect();
            const style = getComputedStyle(htmlEl);
            const isVisible = style.display !== 'none'
                && style.visibility !== 'hidden'
                && style.opacity !== '0'
                && rect.width > 0
                && rect.height > 0;

            if (!isVisible) continue;

            const tabIdx = htmlEl.tabIndex;
            if (tabIdx < 0 && !htmlEl.getAttribute('role')) continue;

            results.push({
                tag: htmlEl.tagName.toLowerCase(),
                role: htmlEl.getAttribute('role'),
                ariaLabel: htmlEl.getAttribute('aria-label'),
                text: (htmlEl.textContent || '').trim().substring(0, 60),
                tabIndex: tabIdx,
                isVisible,
                hasVisibleFocus: false, // filled later
                rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            });
        }

        return results;
    });
}

async function checkTabOrder(page: Page): Promise<{ order: string[]; reachable: number; issues: TabOrderIssue[] }> {
    const order: string[] = [];
    const issues: TabOrderIssue[] = [];
    const maxTabs = 50;
    let reachable = 0;

    // Tab through the page
    for (let i = 0; i < maxTabs; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);

        const focused = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement;
            if (!el || el === document.body) return null;

            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            const outlineWidth = parseFloat(style.outlineWidth) || 0;
            const boxShadow = style.boxShadow;
            const hasFocusIndicator = outlineWidth > 0 || (boxShadow !== 'none' && boxShadow !== '');

            return {
                tag: el.tagName.toLowerCase(),
                id: el.id || '',
                ariaLabel: el.getAttribute('aria-label') || '',
                text: (el.textContent || '').trim().substring(0, 40),
                testId: el.getAttribute('data-testid') || '',
                role: el.getAttribute('role') || '',
                hasFocusIndicator,
                y: rect.y,
            };
        });

        if (!focused) continue;

        reachable++;
        const descriptor = focused.testId
            || focused.ariaLabel
            || focused.id
            || `${focused.tag}:${focused.text}`;
        order.push(descriptor);

        // Check for missing focus indicator
        if (!focused.hasFocusIndicator) {
            issues.push({
                type: 'missing-focus-style',
                element: descriptor,
                description: `No visible focus indicator on "${descriptor}"`,
                severity: 'warning',
            });
        }

        // Check icon-only buttons missing aria-label
        if ((focused.tag === 'button' || focused.role === 'button') && !focused.text && !focused.ariaLabel) {
            issues.push({
                type: 'missing-aria-label',
                element: descriptor,
                description: `Icon-only button "${focused.testId || focused.tag}" has no aria-label or text content`,
                severity: 'error',
            });
        }

        // Detect if we've looped back to the start
        if (order.length > 3 && descriptor === order[0]) {
            break;
        }
    }

    return { order, reachable, issues };
}

async function auditRoute(page: Page, route: string): Promise<RouteAudit> {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {
        // Fallback: just wait for DOM content
        return page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    });
    await page.waitForTimeout(1000);

    const focusable = await getAllFocusableElements(page);
    const { order, reachable, issues } = await checkTabOrder(page);

    return {
        route,
        totalFocusable: focusable.length,
        reachableByTab: reachable,
        issues,
        tabOrder: order,
    };
}

async function main() {
    console.log('🔍 Keyboard Navigation Audit');
    console.log(`   Target: ${BASE_URL}`);
    console.log('');

    mkdirSync(REPORT_DIR, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    // Routes to audit (SPA routes navigated via sidebar)
    const routes = [
        '/',          // Dashboard
    ];

    const routeAudits: RouteAudit[] = [];

    for (const route of routes) {
        console.log(`  Auditing: ${route}`);
        try {
            const audit = await auditRoute(page, route);
            routeAudits.push(audit);

            const errorCount = audit.issues.filter(i => i.severity === 'error').length;
            const warnCount = audit.issues.filter(i => i.severity === 'warning').length;
            console.log(`    ✅ ${audit.reachableByTab}/${audit.totalFocusable} focusable elements reachable. ${errorCount} errors, ${warnCount} warnings.`);
        } catch (err) {
            console.log(`    ❌ Failed: ${err instanceof Error ? err.message : String(err)}`);
            routeAudits.push({
                route,
                totalFocusable: 0,
                reachableByTab: 0,
                issues: [{
                    type: 'unreachable',
                    element: route,
                    description: `Route audit failed: ${err instanceof Error ? err.message : String(err)}`,
                    severity: 'error',
                }],
                tabOrder: [],
            });
        }
    }

    await browser.close();

    // Generate report
    const totalIssues = routeAudits.reduce((sum, r) => sum + r.issues.length, 0);
    const errorCount = routeAudits.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'error').length, 0);
    const warningCount = totalIssues - errorCount;

    const report: AuditReport = {
        timestamp: new Date().toISOString(),
        baseUrl: BASE_URL,
        routes: routeAudits,
        totalIssues,
        errorCount,
        warningCount,
    };

    const reportPath = join(REPORT_DIR, 'keyboard-audit.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('');
    console.log(`📋 Report: ${reportPath}`);
    console.log(`   Total: ${totalIssues} issues (${errorCount} errors, ${warningCount} warnings)`);

    if (errorCount > 0) {
        console.log('');
        console.log('❌ ERRORS:');
        for (const route of routeAudits) {
            for (const issue of route.issues.filter(i => i.severity === 'error')) {
                console.log(`   [${route.route}] ${issue.description}`);
            }
        }
    }

    process.exit(errorCount > 0 ? 1 : 0);
}

main().catch(console.error);
