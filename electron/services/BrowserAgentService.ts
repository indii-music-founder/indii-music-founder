
import { BrowserWindow, session } from 'electron';

/**
 * BrowserAgentService
 * 
 * Manages a hidden Electron BrowserWindow for autonomous agent tasks.
 * Replaces Puppeteer to reduce bundle size (~150MB savings).
 * 
 * Uses 'gemini-2.5-pro-ui-checkpoint' (via Agent Driver) as the brain,
 * and this service as the body/executor.
 */
export class BrowserAgentService {
    private window: BrowserWindow | null = null;
    private isInitializing = false;

    /**
     * Starts the browser session (Hidden Window).
     */
    async startSession(): Promise<void> {
        if (this.window || this.isInitializing) return;

        try {
            this.isInitializing = true;
            console.log('[BrowserAgent] Starting Native/Electron session...');

            this.window = new BrowserWindow({
                show: false, // Hidden
                width: 1280,
                height: 800,
                webPreferences: {
                    offscreen: false, // We can run it hidden without full offscreen rendering
                    nodeIntegration: false,
                    contextIsolation: true,
                    sandbox: true, // Safer
                    webSecurity: true, // Enforce CORS etc.
                }
            });

            // Set user agent
            this.window.webContents.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Handle window close
            this.window.on('closed', () => {
                this.window = null;
            });

            console.log('[BrowserAgent] Session started.');

        } catch (error) {
            console.error('[BrowserAgent] Failed to start session:', error);
            throw error;
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Navigates to a URL.
     */
    async navigateTo(url: string): Promise<void> {
        if (!this.window) throw new Error('Session not started');

        console.log(`[BrowserAgent] Navigating to: ${url}`);

        // Setup one-time fail handler
        const failParams = { url, errorCode: 0, errorDescription: '' };
        const failHandler = (event: any, code: number, desc: string, failingUrl: string) => {
            if (failingUrl === url) {
                failParams.errorCode = code;
                failParams.errorDescription = desc;
            }
        };
        this.window.webContents.once('did-fail-load', failHandler);

        try {
            await this.window.loadURL(url);
        } catch (e) {
            throw new Error(`Navigation failed: ${failParams.errorDescription || String(e)}`);
        } finally {
            this.window.webContents.removeListener('did-fail-load', failHandler);
        }
    }

    /**
     * Captures a screenshot and basic page info.
     */
    async captureSnapshot(): Promise<{ title: string; url: string; text: string; screenshotBase64: string }> {
        if (!this.window) throw new Error('Session not started');

        const title = this.window.getTitle();
        const url = this.window.webContents.getURL();

        // Capture Page Image
        const image = await this.window.webContents.capturePage();
        const screenshotBase64 = image.toDataURL(); // Returns props 'data:image/png;base64,...'

        // Extract Main Text via JS
        const text = await this.window.webContents.executeJavaScript('document.body.innerText').catch(() => '');

        return {
            title,
            url,
            text,
            screenshotBase64
        };
    }

    /**
     * Types into a selector.
     * Robust implementation that attempts to mimic user typing.
     */
    async typeInto(selector: string, text: string): Promise<void> {
        if (!this.window) throw new Error('Session not started');

        // Wait for selector existence first
        await this.waitForSelector(selector);

        // Focus and type using Input Events for better framework compatibility (React/Vue)
        // We set the value and dispatch events because 'insertText' can be flaky with some virtual DOMs
        const script = `
            (() => {
                const el = document.querySelector('${selector}');
                if (!el) throw new Error('Element not found: ${selector}');
                el.focus();
                el.value = '${text.replace(/'/g, "\\'")}';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            })()
        `;
        await this.window.webContents.executeJavaScript(script);
    }

    /**
     * Clicks a selector.
     */
    async click(selector: string): Promise<void> {
        if (!this.window) throw new Error('Session not started');

        await this.waitForSelector(selector);

        const script = `
            (() => {
                const el = document.querySelector('${selector}');
                if (!el) throw new Error('Element not found: ${selector}');
                el.click();
            })()
        `;
        await this.window.webContents.executeJavaScript(script);
    }

    /**
     * Presses a key.
     */
    async pressKey(key: string): Promise<void> {
        if (!this.window) throw new Error('Session not started');
        await this.window.webContents.sendInputEvent({ type: 'keyDown', keyCode: key });
        await this.window.webContents.sendInputEvent({ type: 'keyUp', keyCode: key });
    }

    /**
     * Waits for a selector (simple polling).
     */
    async waitForSelector(selector: string, timeout = 10000): Promise<void> {
        if (!this.window) throw new Error('Session not started');

        const script = `
            new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    clearInterval(intervalId);
                    reject('Timeout waiting for ${selector}');
                }, ${timeout});

                const intervalId = setInterval(() => {
                    if (document.querySelector('${selector}')) {
                        clearInterval(intervalId);
                        clearTimeout(timeoutId);
                        resolve(true);
                    }
                }, 200);
            })
        `;

        await this.window.webContents.executeJavaScript(script);
    }

    /**
     * Scrolls the page.
     */
    async scroll(direction: string, amount: number): Promise<void> {
        if (!this.window) throw new Error('Session not started');

        let script = '';
        if (direction === 'top') {
            script = 'window.scrollTo(0, 0)';
        } else if (direction === 'bottom') {
            script = 'window.scrollTo(0, document.body.scrollHeight)';
        } else {
            const y = direction === 'up' ? -amount : amount;
            script = `window.scrollBy(0, ${y})`;
        }
        await this.window.webContents.executeJavaScript(script);
    }

    /**
     * Waits for a specified duration.
     */
    async wait(duration: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    /**
     * Performs an action on the page.
     */
    async performAction(action: string, selector: string, text?: string): Promise<{ success: boolean; error?: string }> {
        if (!this.window) throw new Error('Session not started');
        try {
            if (action === 'click') {
                await this.click(selector);
            } else if (action === 'type') {
                if (text === undefined) throw new Error('Text is required for type action');
                await this.typeInto(selector, text);
            } else if (action === 'scroll') {
                const direction = selector || 'down';
                const amount = text ? parseInt(text, 10) : 500;
                await this.scroll(direction, amount);
            } else if (action === 'wait') {
                const duration = text ? parseInt(text, 10) : 1000;
                await this.wait(duration);
            } else {
                throw new Error(`Unsupported action: ${action}`);
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
        if (this.window) {
            console.log('[BrowserAgent] Closing session...');
            this.window.close(); // Close the window
            this.window = null;
        }
    }
}

export const browserAgentService = new BrowserAgentService();
