import { wrapTool, toolSuccess, toolError } from '../utils/ToolUtils';
import { blenderService } from '@/services/blender/BlenderService';
import type { AnyToolFunction } from '../types';
import type { BlenderTemplateId, BlenderRenderRequest } from '@/services/blender/types';

export const BlenderTools: Record<string, AnyToolFunction> = {
    blender_get_status: wrapTool('blender_get_status', async () => {
        try {
            const status = await blenderService.getStatus();
            return toolSuccess(status, status.installed
                ? `Blender is available (${status.version ?? 'installed'}, GPU: ${status.gpuAcceleration})`
                : 'Blender is not detected on this system.');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return toolError(`Failed to check Blender status: ${message}`);
        }
    }),

    blender_list_templates: wrapTool('blender_list_templates', async () => {
        try {
            const templates = await blenderService.listTemplates();
            return toolSuccess(templates, `Found ${templates.length} procedural 3D music video templates.`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return toolError(`Failed to list Blender templates: ${message}`);
        }
    }),

    blender_render_music_video: wrapTool('blender_render_music_video', async (args: Record<string, unknown>) => {
        const audioFilePath = String(args.audioFilePath ?? '');
        const outputVideoPath = String(args.outputVideoPath ?? '');
        const templateId = String(args.templateId ?? 'audio_reactive_tunnel') as BlenderTemplateId;

        if (!audioFilePath) return toolError('Parameter "audioFilePath" is required.');
        if (!outputVideoPath) return toolError('Parameter "outputVideoPath" is required.');

        try {
            const request: BlenderRenderRequest = {
                audioFilePath,
                outputVideoPath,
                templateId,
                bpm: args.bpm ? Number(args.bpm) : undefined,
                durationSeconds: args.durationSeconds ? Number(args.durationSeconds) : 30,
                fps: args.fps ? Number(args.fps) : 30,
                resolution: (args.resolution as BlenderRenderRequest['resolution']) ?? '1080p',
                aspectRatio: (args.aspectRatio as BlenderRenderRequest['aspectRatio']) ?? '16:9',
                engine: (args.engine as BlenderRenderRequest['engine']) ?? 'BLENDER_EEVEE_NEXT',
                visualTokens: args.visualTokens as BlenderRenderRequest['visualTokens']
            };

            const result = await blenderService.renderMusicVideo(request);
            if (!result.success) {
                return toolError(result.error ?? 'Blender render failed.');
            }
            return toolSuccess(result, `Successfully rendered 3D music video to: ${result.outputPath}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return toolError(`Blender render error: ${message}`);
        }
    }),

    blender_live_command: wrapTool('blender_live_command', async (args: Record<string, unknown>) => {
        const action = String(args.action ?? 'ping');
        const params = (args.params as Record<string, unknown>) ?? {};

        try {
            const result = await blenderService.sendLiveCommand(action, params);
            return toolSuccess(result, `Executed live Blender command: ${action}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return toolError(`Live Blender command failed: ${message}`);
        }
    })
};
