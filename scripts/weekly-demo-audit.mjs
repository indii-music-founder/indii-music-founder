#!/usr/bin/env node
// Hour 2 of the demo-audit runbook: walk the 12 demo-path modules with Playwright,
// capture screenshots + console + network failures, and write AUDIT_HOUR2.md.
//
// Invoked by .github/workflows/weekly-demo-audit.yml. Assumes the dev server is
// already running on localhost:4243 (started in Hour 1.6).
//
// Exit code: 0 if all modules GREEN/YELLOW, 1 if any RED. The workflow uses this
// to gate the verdict.

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SCREENSHOT_DIR = path.join(ROOT, '.agent', 'screenshots');
const CONSOLE_DIR = path.join(ROOT, '.agent', 'console_logs');
const NETWORK_DIR = path.join(ROOT, '.agent', 'network');
const BASE_URL = process.env.AUDIT_BASE_URL || 'http://localhost:4243';

const MODULES = [
  'onboarding',
  'dashboard',
  'creative',
  'video',
  'agent',
  'distribution',
  'finance',
  'publishing',
  'marketing',
  'social',
  'settings',
  'files',
];

async function ensureDirs() {
  for (const d of [SCREENSHOT_DIR, CONSOLE_DIR, NETWORK_DIR]) {
    await fs.mkdir(d, { recursive: true });
  }
}

function classify(consoleErrors, networkFailures) {
  if (consoleErrors.length > 0 || networkFailures.length > 0) {
    if (consoleErrors.some(e => /TypeError|ReferenceError|SyntaxError/.test(e))) return 'RED';
    return 'YELLOW';
  }
  return 'GREEN';
}

async function visitModule(browser, mod) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const networkFailures = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', resp => {
    if (resp.status() >= 400) networkFailures.push(`${resp.status()} ${resp.url()}`);
  });

  try {
    // Try the URL-sync route first; React Router 7 supports both /<mod> and /#/<mod>.
    await page.goto(`${BASE_URL}/${mod}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(5000); // lazy-load settle

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `2.2-${mod}-pre.png`),
      fullPage: false,
    });

    // Persist console + network captures
    await fs.writeFile(
      path.join(CONSOLE_DIR, `2.2-${mod}.txt`),
      consoleErrors.join('\n') || '(no console errors)',
    );
    await fs.writeFile(
      path.join(NETWORK_DIR, `2.2-${mod}.txt`),
      networkFailures.join('\n') || '(no network failures)',
    );

    return {
      module: mod,
      verdict: classify(consoleErrors, networkFailures),
      consoleErrors: consoleErrors.length,
      networkFailures: networkFailures.length,
      note: '',
    };
  } catch (err) {
    // Best-effort error screenshot
    try {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `2.2-${mod}-error.png`),
        fullPage: false,
      });
    } catch (e) { /* ignore */ }

    // Best-effort HTML capture
    try {
      const content = await page.content();
      await fs.writeFile(path.join(CONSOLE_DIR, `2.2-${mod}-error-dom.html`), content);
    } catch (e) { /* ignore */ }

    return {
      module: mod,
      verdict: 'RED',
      consoleErrors: consoleErrors.length,
      networkFailures: networkFailures.length,
      note: `navigation/load error: ${err.message}`,
    };
  } finally {
    // Persist console + network captures regardless of success/failure
    await fs.writeFile(
      path.join(CONSOLE_DIR, `2.2-${mod}.txt`),
      consoleErrors.join('\n') || '(no console errors)',
    );
    await fs.writeFile(
      path.join(NETWORK_DIR, `2.2-${mod}.txt`),
      networkFailures.join('\n') || '(no network failures)',
    );
    
    // Explicitly cleanup listeners to prevent any chance of memory leaks/cross-module interference
    try {
      page.removeAllListeners('console');
      page.removeAllListeners('response');
    } catch (e) { /* ignore */ }

    await context.close();
  }
}

async function writeReport(rows) {
  const lines = [
    '# Hour 2 Audit — Cold-Start Journey',
    '',
    `**Run:** ${new Date().toISOString()}`,
    `**Base URL:** ${BASE_URL}`,
    '',
    '| Module | Verdict | Console errors | Network failures | Notes |',
    '|--------|---------|----------------|------------------|-------|',
    ...rows.map(r => `| ${r.module} | ${r.verdict} | ${r.consoleErrors} | ${r.networkFailures} | ${r.note} |`),
    '',
    '## Screenshots',
    `All in \`.agent/screenshots/\`. Total: ${rows.length} pre-action shots.`,
  ];
  await fs.writeFile(path.join(ROOT, '.agent', 'AUDIT_HOUR2.md'), lines.join('\n'));
}

async function main() {
  await ensureDirs();
  const browser = await chromium.launch({ headless: true });

  const rows = [];
  // Auth/landing first
  const landing = await visitModule(browser, ''); // root path
  landing.module = 'auth/landing';
  rows.push(landing);

  for (const mod of MODULES) {
    const result = await visitModule(browser, mod);
    rows.push(result);
  }

  await browser.close();
  await writeReport(rows);

  const reds = rows.filter(r => r.verdict === 'RED');
  if (reds.length > 0) {
    console.error(`Hour 2: ${reds.length} RED module(s):`, reds.map(r => r.module).join(', '));
    process.exit(1);
  }
  console.log(`Hour 2 complete. ${rows.length} modules visited. 0 RED.`);
}

main().catch(err => {
  console.error('Hour 2 walker crashed:', err);
  process.exit(1);
});
