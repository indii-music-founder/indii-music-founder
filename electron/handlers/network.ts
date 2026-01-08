import { ipcMain } from 'electron';
import { FetchUrlSchema, validateSender } from '../validation';

export function registerNetworkHandlers() {
    ipcMain.handle('net:fetch-url', async (event, url: string) => {
        try {
            // 1. Validate Sender (Anti-Hijack)
            validateSender(event);

            // 2. Defense in Depth: Validate URL (Anti-SSRF)
            const validUrl = FetchUrlSchema.parse(url);

            console.log(`[Network] Fetching: ${validUrl}`);
            const response = await fetch(validUrl);

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
            }

            // We only need the text content for the AI to analyze (HTML/Terms)
            const text = await response.text();
            return text;
        } catch (error) {
            console.error('[Network] Fetch failed:', error);
            throw new Error(`Network Request Failed: ${(error as Error).message}`);
        }
    });
}
