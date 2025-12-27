
import puppeteer, { Browser, Page } from 'puppeteer';
import { app } from 'electron';
import path from 'path';

/**
 * BrowserAgentService
 * 
 * Manages a headless Chrome instance for autonomous agent tasks.
 * Uses 'puppeteer' (full) to ensure a compatible binary is available.
 */
export class BrowserAgentService {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private isInitializing = false;

    /**
     * Starts the browser session.
     */
    async startSession(): Promise<void> {
        if (this.browser || this.isInitializing) return;

        try {
            this.isInitializing = true;
            console.log('[BrowserAgent] Starting Puppeteer session...');

            // Launch Puppeteer
            // Note: In production, we might need to handle executable paths carefully 
            // if we want to use the bundled Chromium.
            // SECURITY: Removed --no-sandbox for host safety. If running in some Linux environments (Docker),
            // this might need to be conditionally added back with strict URL filtering.
            this.browser = await puppeteer.launch({
                headless: true, // Run hidden
                args: [
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });

            this.page = await this.browser.newPage();

            // Set a realistic viewport
            await this.page.setViewport({ width: 1280, height: 800 });

            // Set user agent to avoid basic bot detection
            await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            console.log('[BrowserAgent] Session started.');

        } catch (error) {
            console.error('[BrowserAgent] Failed to start session:', error);
            throw error;
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Navigates to a URL and waits for network idle.
     */
    async navigateTo(url: string): Promise<void> {
        if (!this.page) throw new Error('Session not started');

        console.log(`[BrowserAgent] Navigating to: ${url}`);
        await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    }

    /**
     * Captures a screenshot and basic page info.
     * Useful for the "Vision" part of the agent.
     */
    async captureSnapshot(): Promise<{ title: string; url: string; text: string; screenshotBase64: string }> {
        if (!this.page) throw new Error('Session not started');

        const title = await this.page.title();
        const url = this.page.url();
        const screenshotBuffer = await this.page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 80 });

        // Extract Main Text
        const text = await this.page.evaluate(() => document.body.innerText);

        return {
            title,
            url,
            text,
            screenshotBase64: screenshotBuffer as string
        };
    }

    /**
     * Types into a selector.
     */
    async typeInto(selector: string, text: string): Promise<void> {
        if (!this.page) throw new Error('Session not started');
        await this.page.waitForSelector(selector);
        await this.page.type(selector, text, { delay: 50 });
    }

    /**
     * Clicks a selector.
     */
    async click(selector: string): Promise<void> {
        if (!this.page) throw new Error('Session not started');
        await this.page.waitForSelector(selector);
        await this.page.click(selector);
    }

    /**
     * Presses a key.
     */
    async pressKey(key: any): Promise<void> {
        if (!this.page) throw new Error('Session not started');
        await this.page.keyboard.press(key);
    }

    /**
     * Waits for a selector.
     */
    async waitForSelector(selector: string, timeout = 10000): Promise<void> {
        if (!this.page) throw new Error('Session not started');
        await this.page.waitForSelector(selector, { timeout });
    }

    /**
     * Performs an action (click or type) on a selector.
     */
    async performAction(action: 'click' | 'type', selector: string, text?: string): Promise<{ success: boolean; error?: string }> {
        if (!this.page) throw new Error('Session not started');
        try {
            await this.page.waitForSelector(selector, { timeout: 10000 });
            if (action === 'click') {
                await this.page.click(selector);
            } else if (action === 'type') {
                if (text === undefined) throw new Error('Text is required for type action');
                await this.page.type(selector, text, { delay: 50 });
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Closes the browser session.
     */
    async closeSession(): Promise<void> {
        if (this.browser) {
            console.log('[BrowserAgent] Closing session...');
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}

export const browserAgentService = new BrowserAgentService();
