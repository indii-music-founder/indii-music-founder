import * as fs from 'node:fs';
import { chromium } from 'playwright';

async function run() {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    page.on('console', msg => {
        console.log(`BROWSER [${msg.type()}]: ${msg.text()}`);
    });

    page.on('pageerror', err => {
        console.log(`BROWSER [uncaught]: ${err.message}`);
    });

    page.on('response', response => {
        if (response.status() === 404) {
            console.log(`BROWSER [404]: ${response.url()}`);
        }
    });

    console.log('Navigating to http://localhost:4242...');
    try {
        await page.goto('http://localhost:4242', { waitUntil: 'networkidle', timeout: 15000 });
    } catch (e: any) {
        console.log('Navigation timed out or failed:', e.message);
    }

    console.log('Waiting 5 seconds for state to settle...');
    await new Promise(r => setTimeout(r, 5000));

    console.log('Evaluating window.store.getState()...');
    const stateStr = await page.evaluate(() => {
        // @ts-ignore
        if (!window.store) return 'window.store is undefined';
        try {
            // @ts-ignore
            const state = window.store.getState();
            return JSON.stringify({
                authLoading: state.authLoading,
                user: state.user ? state.user.uid : null,
                currentModule: state.currentModule,
                authError: state.authError
            });
        } catch (e: any) {
            return `Error reading state: ${e.message}`;
        }
    });

    console.log('State:', stateStr);

    const html = await page.evaluate(() => document.getElementById('root')?.innerHTML || 'NO ROOT');
    fs.writeFileSync('diagnose-output.html', html);
    console.log('Wrote HTML to diagnose-output.html');

    await page.screenshot({ path: '/tmp/diagnose-screenshot.png', fullPage: true });
    console.log('Saved screenshot to /tmp/diagnose-screenshot.png');

    await browser.close();
}

run().catch(console.error);
