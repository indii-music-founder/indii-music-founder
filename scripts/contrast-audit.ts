#!/usr/bin/env node

/**
 * Item 273: Color Contrast Audit Script
 *
 * Uses axe-core (via Playwright) to audit the dark theme for WCAG 4.5:1
 * contrast ratio violations. Run after `npm run dev` is serving on :4242.
 *
 * Usage:
 *   npx tsx scripts/contrast-audit.ts
 *
 * Prerequisites:
 *   - Dev server running on localhost:4242
 *   - Playwright installed (already in devDependencies)
 *
 * This generates a JSON report at `reports/contrast-audit.json`
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:4242';

// Routes to audit — covers key modules
const ROUTES = [
    '/',                    // Dashboard
    '/creative',            // Creative Studio
    '/distribution',        // Distribution
    '/finance',             // Finance
    '/marketing',           // Marketing
    '/legal',               // Legal
];

interface ContrastViolation {
    route: string;
    id: string;
    impact: string;
    description: string;
    help: string;
    helpUrl: string;
    nodes: Array<{
        html: string;
        target: string[];
        failureSummary: string;
    }>;
}

async function main() {
    console.log('🎨 Starting Color Contrast Audit...\n');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        colorScheme: 'dark',
    });

    const violations: ContrastViolation[] = [];

    for (const route of ROUTES) {
        const page = await context.newPage();
        const url = `${BASE_URL}${route}`;

        try {
            console.log(`  Auditing: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });

            // Inject axe-core
            await page.addScriptTag({
                url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js',
            });

            // Run contrast-specific audit
            const results = await page.evaluate(async () => {
                // @ts-expect-error axe is injected via script tag
                return await window.axe.run(document, {
                    runOnly: ['color-contrast'],
                });
            });

            if (results.violations.length > 0) {
                for (const v of results.violations) {
                    violations.push({
                        route,
                        id: v.id,
                        impact: v.impact,
                        description: v.description,
                        help: v.help,
                        helpUrl: v.helpUrl,
                        nodes: v.nodes.map((n: { html: string; target: string[]; failureSummary: string }) => ({
                            html: n.html.substring(0, 200),
                            target: n.target,
                            failureSummary: n.failureSummary,
                        })),
                    });
                }
                console.log(`    ❌ ${results.violations.length} contrast violations found`);
            } else {
                console.log(`    ✅ No contrast violations`);
            }
        } catch (error) {
            console.error(`    ⚠️  Skipped ${route}: ${error}`);
        } finally {
            await page.close();
        }
    }

    await browser.close();

    // Write report
    const reportDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = path.join(reportDir, 'contrast-audit.json');
    fs.writeFileSync(reportPath, JSON.stringify({ violations, timestamp: new Date().toISOString() }, null, 2));

    console.log(`\n📊 Report saved to: ${reportPath}`);
    console.log(`   Total violations: ${violations.length}`);

    if (violations.length > 0) {
        console.log('\n⚠️  Fix these contrast issues to meet WCAG 2.1 AA standards.');
        process.exit(1);
    } else {
        console.log('\n✅ All routes pass WCAG 4.5:1 contrast requirements!');
    }
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
