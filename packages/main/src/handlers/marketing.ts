import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { AgentSupervisor } from '../utils/AgentSupervisor';
import { validateSender } from '../utils/ipc-security';
import { z } from 'zod';

const MarketAnalysisSchema = z.object({
    category: z.string().optional()
});

export function registerMarketingHandlers() {
    ipcMain.handle('marketing:analyze-trends', async (event: IpcMainInvokeEvent, data: unknown) => {
        validateSender(event);

        try {
            const validated = MarketAnalysisSchema.parse(data);

            console.log(`[MarketingHandler] Analyzing market trends for: ${validated.category || 'general'}`);

            const result = await AgentSupervisor.execute<{ success: boolean; error?: string; data?: unknown; message?: string }>(
                'marketing',
                'analyze_market_trends.py',
                [validated.category || 'pop'],
                { timeoutMs: 60000 } // Browser scraping can take time, 60s timeout
            );

            if (!result.success) {
                return { success: false, error: result.error || 'Market analysis failed' };
            }

            return {
                success: true,
                analysis: result.data,
                message: result.message
            };

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('[MarketingHandler] Error:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: 'Validation failed', details: error.errors };
            }
            return { success: false, error: message };
        }
    });
}
