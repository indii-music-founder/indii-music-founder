import log from 'electron-log';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { AgentSupervisor } from '../utils/AgentSupervisor';
import { validateSender } from '../utils/ipc-security';
import { z } from 'zod';

// Schema for Press Release PDF Generation
const PressReleasePdfSchema = z.object({
    headline: z.string().min(1),
    dateline: z.string().optional(),
    introduction: z.string().optional(),
    body_paragraphs: z.array(z.string()).optional(),
    quotes: z.array(z.object({
        speaker: z.string(),
        text: z.string()
    })).optional(),
    boilerplate: z.string().optional(),
    contact_info: z.object({
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional()
    }).optional()
});
export function registerPublicistHandlers() {
    ipcMain.handle('publicist:generate-pdf', async (event: IpcMainInvokeEvent, data: unknown) => {
        validateSender(event);

        try {
            // Validate input data
            const validated = PressReleasePdfSchema.parse(data);

            log.info(`[PublicistHandler] Generating PDF for: ${validated.headline}`);

            // Execute Python script
            const result = await AgentSupervisor.execute<{ success: boolean; error?: string; filePath?: string; message?: string }>(
                'publicist',
                'generate_press_release_pdf.py',
                [JSON.stringify(validated)],
                { timeoutMs: 30000 } // 30s timeout for PDF generation
            );

            if (!result.success) {
                return { success: false, error: result.error || 'PDF generation failed' };
            }

            return {
                success: true,
                filePath: result.filePath,
                message: result.message
            };

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            log.error('[PublicistHandler] Error:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: 'Validation failed', details: error.errors };
            }
            return { success: false, error: message };
        }
    });
}
