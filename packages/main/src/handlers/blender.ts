import log from 'electron-log';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { validateSender } from '../utils/ipc-security';
import { blenderService, BlenderRenderRequest } from '../services/blender/BlenderService';

const RenderRequestSchema = z.object({
    audioFilePath: z.string().min(1),
    outputVideoPath: z.string().min(1),
    templateId: z.enum([
        'audio_reactive_tunnel',
        'vinyl_turntable',
        'chrome_text',
        'spectrum_bars',
        'concert_stage'
    ]),
    bpm: z.number().positive().optional(),
    durationSeconds: z.number().positive().max(600).optional(),
    fps: z.number().int().min(15).max(120).optional(),
    resolution: z.enum(['720p', '1080p', '4k']).optional(),
    aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional(),
    engine: z.enum(['BLENDER_EEVEE_NEXT', 'CYCLES']).optional(),
    visualTokens: z.record(z.unknown()).optional()
});

const LiveCommandSchema = z.object({
    action: z.enum(['ping', 'get_scene_info', 'exec_code']),
    params: z.record(z.unknown()).optional()
});

export function registerBlenderHandlers(): void {
    ipcMain.handle('blender:get-status', async (event: IpcMainInvokeEvent) => {
        validateSender(event);
        try {
            return await blenderService.getStatus();
        } catch (error) {
            log.error('[IPC blender:get-status] Failed:', error);
            throw error;
        }
    });

    ipcMain.handle('blender:list-templates', async (event: IpcMainInvokeEvent) => {
        validateSender(event);
        try {
            return await blenderService.listTemplates();
        } catch (error) {
            log.error('[IPC blender:list-templates] Failed:', error);
            throw error;
        }
    });

    ipcMain.handle('blender:render-music-video', async (event: IpcMainInvokeEvent, request: unknown) => {
        validateSender(event);
        try {
            const validated = RenderRequestSchema.parse(request) as BlenderRenderRequest;
            return await blenderService.renderMusicVideo(validated);
        } catch (error) {
            log.error('[IPC blender:render-music-video] Failed:', error);
            if (error instanceof z.ZodError) {
                return { success: false, error: `Validation Error: ${error.errors.map(e => e.message).join(', ')}` };
            }
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    });

    ipcMain.handle('blender:live-command', async (event: IpcMainInvokeEvent, request: unknown) => {
        validateSender(event);
        try {
            const validated = LiveCommandSchema.parse(request);
            return await blenderService.sendLiveCommand(validated.action, validated.params);
        } catch (error) {
            log.error('[IPC blender:live-command] Failed:', error);
            if (error instanceof z.ZodError) {
                return { error: `Validation Error: ${error.errors.map(e => e.message).join(', ')}` };
            }
            return { error: error instanceof Error ? error.message : String(error) };
        }
    });

    log.info('[IPC] Registered Blender IPC handlers.');
}
