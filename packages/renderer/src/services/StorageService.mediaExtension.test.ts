import { describe, expect, it, vi } from 'vitest';

vi.mock('@/services/firebase', () => ({ db: {}, storage: {}, auth: { currentUser: null } }));

import { mediaExtension } from '@/services/StorageService';

describe('mediaExtension (ISSUE-1693)', () => {
    it('keeps the real audio format', () => {
        expect(mediaExtension('audio/wav')).toBe('wav');
        expect(mediaExtension('audio/wave')).toBe('wav');
        expect(mediaExtension('audio/x-flac')).toBe('flac');
        expect(mediaExtension('audio/x-m4a')).toBe('m4a');
        expect(mediaExtension('video/quicktime')).toBe('mp4');
        expect(mediaExtension('audio/mpeg')).toBe('mp3');
    });
});
