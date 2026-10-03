import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlenderTools } from '../BlenderTools';
import { blenderService } from '@/services/blender/BlenderService';

vi.mock('@/services/blender/BlenderService', () => ({
    blenderService: {
        getStatus: vi.fn(),
        listTemplates: vi.fn(),
        renderMusicVideo: vi.fn(),
        sendLiveCommand: vi.fn()
    }
}));

describe('BlenderTools Agent Toolset', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('blender_get_status returns success when installed', async () => {
        vi.mocked(blenderService.getStatus).mockResolvedValueOnce({
            installed: true,
            executablePath: '/Applications/Blender.app/Contents/MacOS/Blender',
            version: 'Blender 4.3',
            supportedEngines: ['BLENDER_EEVEE_NEXT', 'CYCLES'],
            gpuAcceleration: 'Metal',
            liveConnected: true
        });

        const result = (await BlenderTools.blender_get_status!({})) as any;
        expect(result.success).toBe(true);
        expect(result.data.installed).toBe(true);
        expect(result.data.gpuAcceleration).toBe('Metal');
    });

    it('blender_list_templates returns templates list', async () => {
        vi.mocked(blenderService.listTemplates).mockResolvedValueOnce([
            {
                id: 'audio_reactive_tunnel',
                name: 'Audio Tunnel',
                description: 'Tunnel',
                recommendedAspectRatio: '16:9',
                defaultDurationSeconds: 30,
                supportsCoverArt: false,
                supportsCustomText: true,
                tags: []
            }
        ]);

        const result = (await BlenderTools.blender_list_templates!({})) as any;
        expect(result.success).toBe(true);
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data[0].id).toBe('audio_reactive_tunnel');
    });

    it('blender_render_music_video requires audioFilePath and outputVideoPath', async () => {
        const resultMissingAudio = (await BlenderTools.blender_render_music_video!({
            outputVideoPath: '/out.mp4'
        })) as any;
        expect(resultMissingAudio.success).toBe(false);
        expect(resultMissingAudio.error).toContain('audioFilePath');

        const resultMissingOutput = (await BlenderTools.blender_render_music_video!({
            audioFilePath: '/audio.wav'
        })) as any;
        expect(resultMissingOutput.success).toBe(false);
        expect(resultMissingOutput.error).toContain('outputVideoPath');
    });

    it('blender_render_music_video forwards options to service', async () => {
        vi.mocked(blenderService.renderMusicVideo).mockResolvedValueOnce({
            success: true,
            outputPath: '/renders/music_video.mp4'
        });

        const result = (await BlenderTools.blender_render_music_video!({
            audioFilePath: '/music/master.wav',
            outputVideoPath: '/renders/music_video.mp4',
            templateId: 'vinyl_turntable',
            bpm: 120,
            durationSeconds: 15,
            fps: 30,
            aspectRatio: '16:9',
            resolution: '1080p'
        })) as any;

        expect(result.success).toBe(true);
        expect(blenderService.renderMusicVideo).toHaveBeenCalledWith(
            expect.objectContaining({
                audioFilePath: '/music/master.wav',
                outputVideoPath: '/renders/music_video.mp4',
                templateId: 'vinyl_turntable',
                bpm: 120
            })
        );
    });

    it('blender_live_command executes ping or scene info', async () => {
        vi.mocked(blenderService.sendLiveCommand).mockResolvedValueOnce({
            status: 'ok',
            version: '1.0.0',
            blender: '4.3.0'
        });

        const result = (await BlenderTools.blender_live_command!({
            action: 'ping'
        })) as any;

        expect(result.success).toBe(true);
        expect(blenderService.sendLiveCommand).toHaveBeenCalledWith('ping', {});
    });
});
