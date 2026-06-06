import log from 'electron-log';
import { ipcMain, app, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { AgentActionSchema, AgentNavigateSchema, AgentHistorySaveSchema, AgentHistoryIdSchema } from '../utils/validation';
import { validateSender } from '../utils/ipc-security';
import { validateSafeUrlAsync } from '../utils/network-security';
import { historyStore } from '../services/HistoryStore';

export function registerAgentHandlers() {
    // Agent History Persistence (Production Ready)
    ipcMain.handle('agent:save-history', async (event: IpcMainInvokeEvent, id: string, data: unknown) => {
        try {
            validateSender(event);
            AgentHistorySaveSchema.parse({ id, data });

            historyStore.save(id, data as Record<string, unknown>);
            return { success: true };
        } catch (error) {
            log.error('Agent History Save Failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('agent:get-history', async (event, id: string) => {
        try {
            validateSender(event);
            const validatedId = AgentHistoryIdSchema.parse(id);

            const session = historyStore.get(validatedId);
            return { success: true, data: session };
        } catch (error) {
            log.error('Agent History Get Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('agent:delete-history', async (event, id: string) => {
        try {
            validateSender(event);
            const validatedId = AgentHistoryIdSchema.parse(id);

            historyStore.delete(validatedId);
            return { success: true };
        } catch (error) {
            log.error('Agent History Delete Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    // Foundational Skills (Audit & Memory)
    ipcMain.handle('agent:scan-directory', async (event: IpcMainInvokeEvent) => {
        try {
            validateSender(event);
            const { foundationalSkillService } = await import('../services/FoundationalSkillService');
            const result = await foundationalSkillService.scanDirectory();
            return { success: true, data: result };
        } catch (error) {
            log.error('Agent Scan Directory Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcMain.handle('agent:create-artifact', async (event: IpcMainInvokeEvent, filename: string, content: string, options: any) => {
        try {
            validateSender(event);
            const artifactDir = path.join(process.cwd(), 'artifacts');
            await fs.mkdir(artifactDir, { recursive: true });
            
            // Basic path safety check to prevent directory traversal
            const safePath = path.resolve(artifactDir, filename);
            if (!safePath.startsWith(artifactDir)) {
                throw new Error('Invalid artifact filename');
            }
            
            await fs.writeFile(safePath, content, 'utf-8');
            return { success: true, data: { path: safePath, ...options } };
        } catch (error) {
            log.error('Agent Create Artifact Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('agent:list-artifacts', async (event: IpcMainInvokeEvent) => {
        try {
            validateSender(event);
            const artifactDir = path.join(process.cwd(), 'artifacts');
            try {
                await fs.access(artifactDir);
            } catch {
                return { success: true, data: [] }; // Directory doesn't exist yet
            }
            const files = await fs.readdir(artifactDir);
            const artifacts = files.filter(f => f.endsWith('.md')).map(f => ({ filename: f }));
            return { success: true, data: artifacts };
        } catch (error) {
            log.error('Agent List Artifacts Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('agent:read-artifact', async (event: IpcMainInvokeEvent, filename: string) => {
        try {
            validateSender(event);
            const artifactDir = path.join(process.cwd(), 'artifacts');
            const safePath = path.resolve(artifactDir, filename);
            if (!safePath.startsWith(artifactDir)) {
                throw new Error('Invalid artifact filename');
            }
            const content = await fs.readFile(safePath, 'utf-8');
            return { success: true, data: content };
        } catch (error) {
            log.error('Agent Read Artifact Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcMain.handle('agent:multi-replace-file-content', async (event: IpcMainInvokeEvent, args: any) => {
        try {
            validateSender(event);
            const { targetFile, replacementChunks } = args;
            
            // Verify path safety
            if (!targetFile || targetFile.includes('..')) {
                 throw new Error('Invalid file path');
            }

            let content = await fs.readFile(targetFile, 'utf-8');
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const lines = content.split('\n');

            for (const chunk of replacementChunks) {
                const { targetContent, replacementContent } = chunk;
                const occurences = content.split(targetContent).length - 1;
                if (occurences === 1) {
                    content = content.replace(targetContent, replacementContent);
                } else if (occurences > 1) {
                    throw new Error(`Target content occurs multiple times, cannot safely replace: ${targetContent.substring(0, 30)}...`);
                } else {
                     throw new Error(`Target content not found in file: ${targetContent.substring(0, 30)}...`);
                }
            }

            await fs.writeFile(targetFile, content, 'utf-8');
            return { success: true, data: { file: targetFile } };
        } catch (error) {
            log.error('Agent Multi Replace Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('agent:update-knowledge', async (event: IpcMainInvokeEvent, filePath: string, action: 'add' | 'remove', content: string) => {
        try {
            validateSender(event);
            // Basic path safety check
            if (!filePath.includes('agents/') || filePath.includes('..')) {
                throw new Error('Invalid file path for knowledge update');
            }
            
            const { foundationalSkillService } = await import('../services/FoundationalSkillService');
            const result = await foundationalSkillService.updateKnowledge(filePath, action, content);
            return { success: true, ...result };
        } catch (error) {
            log.error('Agent Update Knowledge Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    // Test Browser Agent (Development ONLY)
    if (!app.isPackaged) {
        ipcMain.handle('test:browser-agent', async (event: IpcMainInvokeEvent, query?: string) => {
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
                log.error('Agent Test Failed:', error);
                return { success: false, error: String(error) };
            }
        });

        // Secure Agent IPC - Development Only
        ipcMain.handle('agent:navigate-and-extract', async (event: IpcMainInvokeEvent, url: string) => {
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
                log.error('Agent Navigate Failed:', error);
                const { browserAgentService } = await import('../services/BrowserAgentService');
                await browserAgentService.closeSession();

                if (error instanceof z.ZodError) {
                    return { success: false, error: `Validation Error: ${error.errors[0].message}` };
                }
                return { success: false, error: String(error) };
            }
        });

        ipcMain.handle('agent:perform-action', async (event: IpcMainInvokeEvent, action: string, selector: string, text?: string) => {
            try {
                validateSender(event);
                // Validate inputs against schema (allows text to be optional)
                const validated = AgentActionSchema.parse({ action, selector, text });

                const { browserAgentService } = await import('../services/BrowserAgentService');
                return await browserAgentService.performAction(validated.action as "click" | "type" | "hover", validated.selector, validated.text);
            } catch (error) {
                log.error('Agent Action Failed:', error);
                if (error instanceof z.ZodError) {
                    return { success: false, error: `Validation Error: ${error.errors[0].message}` };
                }
                return { success: false, error: String(error) };
            }
        });
    }

    ipcMain.handle('agent:get-capability-registry', async (event: IpcMainInvokeEvent) => {
        try {
            validateSender(event);
            const registryPath = path.join(process.cwd(), 'agents/capability_registry.json');
            const data = await fs.readFile(registryPath, 'utf-8');
            return { success: true, data: JSON.parse(data) };
        } catch (error) {
            log.error('Failed to get capability registry:', error);
            return { success: false, error: String(error) };
        }
    });
}
