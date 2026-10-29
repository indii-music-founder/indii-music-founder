import log from 'electron-log';
import { app, ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { AgentNavigateSchema, AgentHistorySaveSchema, AgentHistoryIdSchema } from '../utils/validation';
import { validateSender } from '../utils/ipc-security';
import { historyStore } from '../services/HistoryStore';
import { accessControlService } from '../security/AccessControlService';
import { replaceUniqueAgentChunks, resolveAuthorizedAgentFile } from '../utils/agent-file-access';
import { AgentArtifactStore, agentStoragePaths } from '../utils/agent-storage';

const storagePaths = () => agentStoragePaths(app.isPackaged, app.getPath('userData'), process.resourcesPath, process.cwd());
const artifacts = () => new AgentArtifactStore(storagePaths().base);
const ArtifactOptions = z.object({ artifactType: z.string().optional(), requestFeedback: z.boolean().optional() }).optional();

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

    ipcMain.handle('agent:create-artifact', async (event: IpcMainInvokeEvent, filename: string, content: string, options: unknown) => {
        try {
            validateSender(event);
            const metadata = ArtifactOptions.parse(options);
            const safePath = await artifacts().write(filename, content);
            return { success: true, data: { ...metadata, path: safePath } };
        } catch (error) {
            log.error('Agent Create Artifact Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('agent:list-artifacts', async (event: IpcMainInvokeEvent) => {
        try {
            validateSender(event);
            return { success: true, data: await artifacts().list() };
        } catch (error) {
            log.error('Agent List Artifacts Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('agent:read-artifact', async (event: IpcMainInvokeEvent, filename: string) => {
        try {
            validateSender(event);
            const content = await artifacts().read(filename);
            return { success: true, data: content };
        } catch (error) {
            log.error('Agent Read Artifact Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('agent:multi-replace-file-content', async (event: IpcMainInvokeEvent, args: { targetFile?: unknown; replacementChunks?: unknown }) => {
        try {
            validateSender(event);
            const resolvedPath = resolveAuthorizedAgentFile(args?.targetFile, process.cwd(), file => accessControlService.verifyAccess(file));
            const content = await fs.readFile(resolvedPath, 'utf-8');
            const replacement = replaceUniqueAgentChunks(content, args?.replacementChunks);
            await fs.writeFile(resolvedPath, replacement, 'utf-8');
            return { success: true, data: { file: resolvedPath } };
        } catch (error) {
            log.error('Agent Multi Replace Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('agent:update-knowledge', async (event: IpcMainInvokeEvent, filePath: string, action: 'add' | 'remove', content: string) => {
        try {
            validateSender(event);
            if (!filePath || typeof filePath !== 'string') {
                throw new Error('Invalid file path for knowledge update');
            }
            const agentsDir = path.join(process.cwd(), 'agents');
            const resolvedPath = path.resolve(process.cwd(), filePath);
            const rel = path.relative(agentsDir, resolvedPath);
            if (rel.startsWith('..') || path.isAbsolute(rel)) {
                throw new Error('Invalid file path for knowledge update');
            }
            
            const { foundationalSkillService } = await import('../services/FoundationalSkillService');
            const result = await foundationalSkillService.updateKnowledge(resolvedPath, action, content);
            return { ...result, success: result.success ?? true };
        } catch (error) {
            log.error('Agent Update Knowledge Failed:', error);
            return { success: false, error: String(error) };
        }
    });

    // Read-only web extraction is available in packaged and development builds.
    // A request owns its ephemeral session from start through cleanup; there is
    // no shared browser state or input/action IPC.
    ipcMain.handle('agent:extract-web-page', async (event: IpcMainInvokeEvent, url: string) => {
        try {
            validateSender(event);
            const validated = AgentNavigateSchema.parse({ url });
            const { webExtractionService } = await import('../services/WebExtractionService');
            const data = await webExtractionService.extract(validated.url);
            return { success: true, data };
        } catch (error) {
            log.error('Agent Web Extraction Failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors[0].message}` };
            }
            return { success: false, error: String(error) };
        }
    });

    ipcMain.handle('agent:get-capability-registry', async (event: IpcMainInvokeEvent) => {
        try {
            validateSender(event);
            const registryPath = storagePaths().registry;
            const data = await fs.readFile(registryPath, 'utf-8');
            return { success: true, data: JSON.parse(data) };
        } catch (error) {
            log.error('Failed to get capability registry:', error);
            return { success: false, error: String(error) };
        }
    });
}
