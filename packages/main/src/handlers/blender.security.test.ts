import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ipcMain } from 'electron';
import { registerBlenderHandlers } from './blender';
import { blenderService } from '../services/blender/BlenderService';
import * as ipcSecurity from '../utils/ipc-security';

vi.mock('electron', () => {
    const handlers = new Map<string, (...args: any[]) => any>();
    return {
        ipcMain: {
            handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
                handlers.set(channel, handler);
            }),
            __getHandler: (channel: string) => handlers.get(channel)
        }
    };
});

vi.mock('../utils/ipc-security', () => ({
    validateSender: vi.fn()
}));

vi.mock('../services/blender/BlenderService', () => ({
    blenderService: {
        getStatus: vi.fn().mockResolvedValue({ installed: true }),
        listTemplates: vi.fn().mockResolvedValue([{ id: 'audio_reactive_tunnel' }]),
        renderMusicVideo: vi.fn().mockResolvedValue({ success: true, outputPath: '/out.mp4' }),
        sendLiveCommand: vi.fn().mockResolvedValue({ status: 'ok' })
    }
}));

describe('Blender Handlers Security & Validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        registerBlenderHandlers();
    });

    it('enforces validateSender on blender:get-status', async () => {
        const handler = (ipcMain as any).__getHandler('blender:get-status');
        expect(handler).toBeDefined();

        const fakeEvent = { senderFrame: { url: 'http://localhost:4243' } };
        await handler(fakeEvent);

        expect(ipcSecurity.validateSender).toHaveBeenCalledWith(fakeEvent);
        expect(blenderService.getStatus).toHaveBeenCalled();
    });

    it('rejects invalid render request with malformed template', async () => {
        const handler = (ipcMain as any).__getHandler('blender:render-music-video');
        expect(handler).toBeDefined();

        const fakeEvent = { senderFrame: { url: 'http://localhost:4243' } };
        const invalidRequest = {
            audioFilePath: '/audio.wav',
            outputVideoPath: '/video.mp4',
            templateId: 'unknown_dangerous_template'
        };

        const result = await handler(fakeEvent, invalidRequest);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Validation Error');
        expect(blenderService.renderMusicVideo).not.toHaveBeenCalled();
    });

    it('accepts valid render request and forwards to blenderService', async () => {
        const handler = (ipcMain as any).__getHandler('blender:render-music-video');
        const fakeEvent = { senderFrame: { url: 'http://localhost:4243' } };
        const validRequest = {
            audioFilePath: '/valid/audio.wav',
            outputVideoPath: '/valid/out.mp4',
            templateId: 'audio_reactive_tunnel',
            bpm: 128,
            durationSeconds: 15,
            fps: 30,
            resolution: '1080p',
            aspectRatio: '16:9'
        };

        const result = await handler(fakeEvent, validRequest);
        expect(result.success).toBe(true);
        expect(blenderService.renderMusicVideo).toHaveBeenCalledWith(validRequest);
    });

    it('validates live command actions strictly', async () => {
        const handler = (ipcMain as any).__getHandler('blender:live-command');
        const fakeEvent = { senderFrame: { url: 'http://localhost:4243' } };

        const invalidCommand = { action: 'format_hard_drive' };
        const result = await handler(fakeEvent, invalidCommand);
        expect(result.error).toContain('Validation Error');
        expect(blenderService.sendLiveCommand).not.toHaveBeenCalled();
    });
});
