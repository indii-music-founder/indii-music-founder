import { _electron as electron, test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Electron IPC', () => {
    test('should communicate with main process', async () => {
        // Locate the electron executable
        // This is a bit hacky but works for local dev
        // Use process.cwd() since we are running from the root
        const electronPath = path.join(process.cwd(), 'node_modules', '.bin', 'electron');

        // Debug: Check if preload script exists
        const preloadPath = path.join(process.cwd(), 'dist-electron', 'electron', 'preload.js');
        console.log('Test: Checking preload path:', preloadPath);
        if (fs.existsSync(preloadPath)) {
            console.log('Test: Preload file exists');
        } else {
            console.error('Test: Preload file MISSING');
        }

        // Launch the app
        // We point to the current directory because package.json "main" points to the compiled main.js
        const electronApp = await electron.launch({
            executablePath: electronPath,
            args: ['.', '--no-sandbox', '--disable-gpu'],
        });

        // Get the first window
        const window = await electronApp.firstWindow();

        // Wait for the window to load
        await window.waitForLoadState('domcontentloaded');

        // Listen to console logs
        window.on('console', msg => console.log(`[Electron Console] ${msg.text()}`));
        window.on('pageerror', err => console.log(`[Electron Page Error] ${err.message}`));

        // Check window title (optional, depends on what you set in main.ts)
        // const title = await window.title();
        // expect(title).toBe('indii-os'); 

        // Verify IPC calls
        // We execute this in the context of the browser window
        const platform = await window.evaluate(async () => {
            // Debug: check if electronAPI is available
            // @ts-ignore
            if (!window.electronAPI) {
                console.error('Window context: window.electronAPI is UNDEFINED');
                return 'undefined-api';
            }
            // @ts-ignore
            return await window.electronAPI.getPlatform();
        });

        const version = await window.evaluate(async () => {
            // @ts-ignore
            return await window.electronAPI.getAppVersion();
        });

        console.log('Platform:', platform);
        console.log('Version:', version);

        // Assertions
        expect(['darwin', 'win32', 'linux']).toContain(platform);
        expect(version).toBe('0.0.0'); // Matches package.json version

        // Close the app
        await electronApp.close();
    });
});
