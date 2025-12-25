import { ipcMain } from 'electron';

export function registerNetworkHandlers() {
    ipcMain.handle('net:fetch-url', async (_event, url: string) => {
        try {
            console.log(`[Network] Fetching: ${url}`);
            const response = await fetch(url);

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
