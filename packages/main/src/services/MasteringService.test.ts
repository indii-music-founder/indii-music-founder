import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    ffmpeg: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
}));

vi.mock('fluent-ffmpeg', () => ({ default: mocks.ffmpeg }));
vi.mock('electron-log', () => ({ default: { info: mocks.info, error: mocks.error } }));

import { MasteringService } from './MasteringService';

describe('MasteringService logging', () => {
    beforeEach(() => vi.clearAllMocks());

    it('passes paths to ffmpeg and returns its error without logging either value', async () => {
        const inputPath = '/private/artist-master-source-5c41.wav';
        const outputPath = '/tmp/artist-master-output-5c41.wav';
        const detail = 'private ffmpeg failure 5c41';
        const callbacks = new Map<string, (error?: Error) => void>();
        const command = {
            audioFilters: vi.fn().mockReturnThis(),
            on: vi.fn((event: string, callback: (error?: Error) => void) => {
                callbacks.set(event, callback);
                return command;
            }),
            save: vi.fn(() => callbacks.get('error')?.(new Error(detail))),
        };
        mocks.ffmpeg.mockReturnValue(command);

        const result = await new MasteringService().masterAudio(inputPath, outputPath, 'warm');

        expect(mocks.ffmpeg).toHaveBeenCalledWith(inputPath, { timeout: 600000 });
        expect(command.save).toHaveBeenCalledWith(outputPath);
        expect(result).toEqual({ success: false, error: detail });
        const logged = JSON.stringify([...mocks.info.mock.calls, ...mocks.error.mock.calls]);
        expect(logged).not.toContain(inputPath);
        expect(logged).not.toContain(outputPath);
        expect(logged).not.toContain(detail);
    });
});
