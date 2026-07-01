import { describe, expect, it, vi } from 'vitest';

import { AppleMusicService } from './AppleMusicService';
import type { PlatformData, StreamDataPoint } from './types';

describe('AppleMusicService', () => {
    it('reports disconnected when no secured MusicKit/backend is configured', async () => {
        const service = new AppleMusicService();

        await expect(service.isConnected()).resolves.toBe(false);
    });

    it('rejects connection when no secured MusicKit/backend is configured', async () => {
        const service = new AppleMusicService();

        await expect(service.connect()).rejects.toThrow(AppleMusicService.UNAVAILABLE_MESSAGE);
    });

    it('returns null platform data when partner analytics are unavailable', async () => {
        const service = new AppleMusicService();

        await expect(service.buildPlatformData('artist-1')).resolves.toBeNull();
    });

    it('returns null stream history when partner history is unavailable', async () => {
        const service = new AppleMusicService();

        await expect(service.buildStreamHistory('artist-1')).resolves.toBeNull();
    });

    it('passes through real partner analytics unchanged', async () => {
        const service = new AppleMusicService();
        const partnerData: PlatformData = {
            platform: 'apple_music',
            streams: 1234,
            saves: 56,
            completionRate: 0.81,
            creatorCount: 0,
        };

        vi.spyOn(service, 'fetchPartnerAnalytics').mockResolvedValue(partnerData);

        await expect(service.buildPlatformData('artist-1')).resolves.toBe(partnerData);
    });

    it('passes through real partner stream history unchanged', async () => {
        const service = new AppleMusicService();
        const partnerHistory: StreamDataPoint[] = [{
            date: '2026-07-01',
            streams: 10,
            saves: 2,
            completions: 8,
            uniqueListeners: 7,
            shares: 1,
            newFollowers: 1,
            playlistAdditions: 0,
        }];

        vi.spyOn(service, 'fetchPartnerStreamHistory').mockResolvedValue(partnerHistory);

        await expect(service.buildStreamHistory('artist-1')).resolves.toBe(partnerHistory);
    });
});
