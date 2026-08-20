import log from 'electron-log';
import { ipcMain } from 'electron';
import { validateSender } from '../utils/ipc-security';
import { AgentSupervisor } from '../utils/AgentSupervisor';
import { BrandConsistencySchema } from '../utils/validation';
import { accessControlService } from '../security/AccessControlService';
import { z } from 'zod';
import path from 'path';

/**
 * Registers IPC handlers for Brand Agent capabilities.
 */
export const registerBrandHandlers = () => {
    log.info('[Handlers] Registering Brand handlers...');

    ipcMain.handle('brand:analyze-consistency', async (event, assetPath: string, brandKit: Record<string, unknown>) => {
        try {
            // 1. Security & Validation
            validateSender(event);

            // Validate inputs
            const validated = BrandConsistencySchema.parse({ assetPath, brandKit });

            // 2. SECURITY: the schema only rejects `..` and non-media
            // extensions — an absolute path like /Users/me/.ssh/keys.png
            // passes it. This handler reads the file's bytes and transmits
            // them to the model provider, so it must sit behind the same
            // authorization gate as audio:analyze: only paths the user
            // granted (dialog) or that live in the app-scoped directories
            // may be read.
            if (!accessControlService.verifyAccess(validated.assetPath)) {
                throw new Error(`Security Violation: Access to ${validated.assetPath} is denied. File was not authorized by user.`);
            }

            log.info(`[Brand] Analyzing consistency for: ${path.basename(validated.assetPath)}`);

            // 3. Execute Python Script via AgentSupervisor
            // Using 60s timeout for vision processing
            const report = await AgentSupervisor.execute<Record<string, unknown>>(
                'brand',
                'analyze_brand_consistency.py',
                [validated.assetPath, JSON.stringify(validated.brandKit)],
                { timeoutMs: 60000 }
            );

            // 4. Return structured result
            return {
                success: true,
                report: report
            };

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown consistency analysis error';
            log.error('[Brand] Consistency analysis failed:', error);
            return {
                success: false,
                error: message,
                details: error instanceof z.ZodError ? error.errors : undefined
            };
        }
    });
};
