import { ipcMain } from 'electron';
import { validateSender } from '../utils/ipc-security';
import { AgentSupervisor } from '../utils/AgentSupervisor';
import { BrandConsistencySchema } from '../utils/validation';
import path from 'path';

/**
 * Registers IPC handlers for Brand Agent capabilities.
 */
export const registerBrandHandlers = () => {
    console.log('[Handlers] Registering Brand handlers...');

    ipcMain.handle('brand:analyze-consistency', async (event, assetPath: string, brandKit: any) => {
        try {
            // 1. Security & Validation
            validateSender(event);

            // Validate inputs
            const validated = BrandConsistencySchema.parse({ assetPath, brandKit });

            console.log(`[Brand] Analyzing consistency for: ${path.basename(validated.assetPath)}`);

            // 2. Execute Python Script via AgentSupervisor
            // Using 60s timeout for vision processing
            const report = await AgentSupervisor.execute<any>(
                'brand',
                'analyze_brand_consistency.py',
                [validated.assetPath, JSON.stringify(validated.brandKit)],
                { timeoutMs: 60000 }
            );

            // 3. Return structured result
            return {
                success: true,
                report: report
            };

        } catch (error: any) {
            console.error('[Brand] Consistency analysis failed:', error);
            return {
                success: false,
                error: error.message || 'Unknown consistency analysis error',
                details: error
            };
        }
    });
};
