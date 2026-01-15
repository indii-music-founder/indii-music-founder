import { ipcMain, app } from 'electron';
import { z } from 'zod';
import { AgentActionSchema, AgentNavigateSchema } from '../utils/validation';
import { validateSender } from '../utils/ipc-security';
import { validateSafeUrlAsync } from '../utils/network-security';

export function registerAgentHandlers() {
    // Test Browser Agent (Development ONLY)
    if (!app.isPackaged) {
        ipcMain.handle('test:browser-agent', async (event: any, query?: string) => {
            const { browserAgentService } = await import('../services/BrowserAgentService');
            try {
                validateSender(event);
                // Input validation (query is optional but if present should be safe)
                if (query && typeof query !== 'string') {
                    throw new Error('Invalid query format');
                }

                await browserAgentService.startSession();
                if (query) {
                    await browserAgentService.navigateTo('https://www.google.com');
                    await browserAgentService.typeInto('[name="q"]', query);
                    await browserAgentService.pressKey('Enter');
                    await browserAgentService.waitForSelector('#search');
                } else {
                    await browserAgentService.navigateTo('https://www.google.com');
                }
                const snapshot = await browserAgentService.captureSnapshot();
                await browserAgentService.closeSession();
                return { success: true, ...snapshot };
            } catch (error) {
                console.error('Agent Test Failed:', error);
                return { success: false, error: String(error) };
            }
        });

        // Secure Agent IPC - Development Only
        ipcMain.handle('agent:navigate-and-extract', async (event: any, url: string) => {
            try {
                validateSender(event);
                const validated = AgentNavigateSchema.parse({ url });

                // SECURITY: Prevent SSRF / Internal Network Scanning
                await validateSafeUrlAsync(validated.url);

                const { browserAgentService } = await import('../services/BrowserAgentService');

                await browserAgentService.startSession();
                await browserAgentService.navigateTo(validated.url);
                const snapshot = await browserAgentService.captureSnapshot();
                await browserAgentService.closeSession();
                return { success: true, ...snapshot };
            } catch (error) {
                console.error('Agent Navigate Failed:', error);
                const { browserAgentService } = await import('../services/BrowserAgentService');
                await browserAgentService.closeSession();

                if (error instanceof z.ZodError) {
                    return { success: false, error: `Validation Error: ${error.errors[0].message}` };
                }
                return { success: false, error: String(error) };
            }
        });

        ipcMain.handle('agent:perform-action', async (event: any, action: string, selector: string, text?: string) => {
            try {
                validateSender(event);
                // Validate inputs against schema (allows text to be optional)
                const validated = AgentActionSchema.parse({ action, selector, text });

                const { browserAgentService } = await import('../services/BrowserAgentService');
                return await browserAgentService.performAction(validated.action as any, validated.selector, validated.text);
            } catch (error) {
                console.error('Agent Action Failed:', error);
                if (error instanceof z.ZodError) {
                    return { success: false, error: `Validation Error: ${error.errors[0].message}` };
                }
                return { success: false, error: String(error) };
            }
        });

        ipcMain.handle('agent:capture-state', async (event: any) => {
            const { browserAgentService } = await import('../services/BrowserAgentService');
            try {
                validateSender(event);
                const snapshot = await browserAgentService.captureSnapshot();
                return { success: true, ...snapshot };
            } catch (error) {
                return { success: false, error: String(error) };
            }
        });
    }
}
