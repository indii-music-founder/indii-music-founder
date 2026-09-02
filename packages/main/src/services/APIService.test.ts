import { beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';

const mocks = vi.hoisted(() => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
}));

vi.mock('electron', () => ({
    app: {
        getPath: vi.fn(() => '/mock/userData'),
    },
}));

vi.mock('fs', () => ({
    default: {
        promises: {
            readFile: mocks.readFile,
            writeFile: mocks.writeFile,
            mkdir: mocks.mkdir,
        },
    },
}));

vi.mock('electron-log', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

import { APIService } from './APIService';

describe('APIService with offline metadata cache', () => {
    let service: APIService;

    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.METADATA_LOOKUP_URL;
        service = new APIService();
    });

    it('returns cached metadata when METADATA_LOOKUP_URL is not set', async () => {
        const cachedSong = {
            id: 'song-1',
            artist: 'Detroit Underground',
            title: 'Submerge',
        };
        mocks.readFile.mockResolvedValue(JSON.stringify(cachedSong));

        const result = await service.getSongMetadata('testhash123');

        expect(result).toEqual(cachedSong);
        expect(mocks.readFile).toHaveBeenCalledWith(
            path.join('/mock/userData', 'metadata-cache', 'tracks', 'testhash123.json'),
            'utf-8'
        );
    });

    it('returns null when METADATA_LOOKUP_URL is not set and cache miss occurs', async () => {
        mocks.readFile.mockRejectedValue(new Error('ENOENT'));

        const result = await service.getSongMetadata('missinghash');

        expect(result).toBeNull();
    });

    it('caches metadata to disk upon successful network fetch', async () => {
        process.env.METADATA_LOOKUP_URL = 'https://api.indii.music/metadata';
        const remoteSong = {
            id: 'song-remote',
            artist: 'Underground Resistance',
            title: 'Transition',
        };

        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => remoteSong,
        });
        globalThis.fetch = mockFetch;

        mocks.mkdir.mockResolvedValue(undefined);
        mocks.writeFile.mockResolvedValue(undefined);

        const result = await service.getSongMetadata('remotehash123');

        expect(result).toEqual(remoteSong);
        expect(mocks.writeFile).toHaveBeenCalledWith(
            path.join('/mock/userData', 'metadata-cache', 'tracks', 'remotehash123.json'),
            expect.stringContaining('Transition'),
            'utf-8'
        );
    });

    it('falls back to offline cache if network fetch throws', async () => {
        process.env.METADATA_LOOKUP_URL = 'https://api.indii.music/metadata';
        const cachedFallback = {
            id: 'song-fallback',
            artist: 'Jeff Mills',
            title: 'The Bells',
        };

        const mockFetch = vi.fn().mockRejectedValue(new Error('Network offline'));
        globalThis.fetch = mockFetch;

        mocks.readFile.mockResolvedValue(JSON.stringify(cachedFallback));

        const result = await service.getSongMetadata('offlinehash123');

        expect(result).toEqual(cachedFallback);
    });
});
