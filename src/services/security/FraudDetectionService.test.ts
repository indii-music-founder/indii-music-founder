
import { describe, it, expect } from 'vitest';
import { FraudDetectionService } from './FraudDetectionService';

describe('FraudDetectionService', () => {
    describe('Artificial Streaming', () => {
        it('should detect looping behavior (Repeated plays)', () => {
            const events = Array(25).fill(0).map((_, i) => ({
                trackId: 't1',
                userId: 'u1',
                timestamp: 1000 + (i * 1000),
                durationPlayed: 30,
                ipAddress: '1.1.1.1',
                userAgent: 'Bot'
            }));

            const alerts = FraudDetectionService.detectArtificialStreaming(events);
            expect(alerts).toHaveLength(1);
            expect(alerts[0].reason).toContain('looped track > 20 times');
        });

        it('should detect IP spikes', () => {
            // 1001 plays from same IP
            const events = Array(1001).fill(0).map((_, i) => ({
                trackId: `t${i}`,
                userId: `u${i}`,
                timestamp: 1000,
                durationPlayed: 30,
                ipAddress: 'BAD_IP',
                userAgent: 'Bot'
            }));

            const alerts = FraudDetectionService.detectArtificialStreaming(events);
            expect(alerts.length).toBeGreaterThan(0);
            expect(alerts[0].severity).toBe('CRITICAL');
            expect(alerts[0].reason).toContain('High volume');
        });
    });

    describe('Broad Spectrum ACR', () => {
        it('should flag "sped up" / nightcore content', async () => {
            const result = await FraudDetectionService.checkBroadSpectrum('my_song_sped_up.wav');
            expect(result.safe).toBe(false);
            expect(result.details).toContain('Pitch/Tempo shift (+25%)');
        });

        it('should flag "slowed" content', async () => {
            const result = await FraudDetectionService.checkBroadSpectrum('my_song_slowed_reverb.wav');
            expect(result.safe).toBe(false);
            expect(result.details).toContain('Pitch/Tempo shift (-20%)');
        });

        it('should pass standard files', async () => {
            const result = await FraudDetectionService.checkBroadSpectrum('master_final.wav');
            expect(result.safe).toBe(true);
        });
    });
});
