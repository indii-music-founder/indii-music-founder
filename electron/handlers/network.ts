import { ipcMain } from 'electron';
import { FetchUrlSchema } from '../utils/validation';
import { z } from 'zod';

export function registerNetworkHandlers() {
    ipcMain.handle('net:fetch-url', async (_event, url: string) => {
        try {
            // Validate Input
            const validatedUrl = FetchUrlSchema.parse(url);

            console.log(`[Network] Fetching: ${validatedUrl}`);
            const response = await fetch(validatedUrl);

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
            }

            // We only need the text content for the AI to analyze (HTML/Terms)
            const text = await response.text();
            return text;
        } catch (error) {
            if (error instanceof z.ZodError) {
                console.error('[Network] Validation failed:', error.errors);
                throw new Error(`Invalid URL: ${error.errors[0].message}`);
            }
            console.error('[Network] Fetch failed:', error);
            throw new Error(`Network Request Failed: ${(error as Error).message}`);
        }
    });
}
