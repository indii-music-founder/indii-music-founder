
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FraudDetectionService } from './FraudDetectionService';

// Mock Firebase Firestore
const mockAddDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();

vi.mock('firebase/firestore', () => ({
    getFirestore: vi.fn(),
    collection: (db: any, col: string) => mockCollection(col),
    addDoc: (ref: any, data: any) => mockAddDoc(ref, data),
    getDocs: (q: any) => mockGetDocs(q),
    query: (ref: any, ...args: any[]) => mockQuery(ref, ...args),
    where: (field: string, op: string, val: any) => mockWhere(field, op, val),
    Timestamp: {
        now: () => ({ toISOString: () => new Date().toISOString() })
    }
}));

// Mock the db export from firebase service
vi.mock('@/services/firebase', () => ({
    db: {}
}));

describe('FraudDetectionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAddDoc.mockResolvedValue({ id: 'mock-alert-id' });
        // Default empty for getDocs
        mockGetDocs.mockResolvedValue({ docs: [] });
    });

    describe('Artificial Streaming', () => {
        it('should detect looping behavior (Repeated plays)', async () => {
            const events = Array(25).fill(0).map((_, i) => ({
                trackId: 't1',
                userId: 'u1',
                timestamp: 1000 + (i * 1000),
                durationPlayed: 30,
                ipAddress: '1.1.1.1',
                userAgent: 'Bot'
            }));

            // Method is now async due to persistence
            const alerts = await FraudDetectionService.detectArtificialStreaming(events);

            expect(alerts).toHaveLength(1);
            expect(alerts[0].reason).toContain('looped track > 20 times');

            // Verify persistence
            expect(mockCollection).toHaveBeenCalledWith('fraud_alerts');
            expect(mockAddDoc).toHaveBeenCalled();
        });

        it('should detect IP spikes', async () => {
            // 1001 plays from same IP
            const events = Array(1001).fill(0).map((_, i) => ({
                trackId: `t${i}`,
                userId: `u${i}`,
                timestamp: 1000,
                durationPlayed: 30,
                ipAddress: 'BAD_IP',
                userAgent: 'Bot'
            }));

            const alerts = await FraudDetectionService.detectArtificialStreaming(events);

            expect(alerts.length).toBeGreaterThan(0);
            expect(alerts[0].severity).toBe('CRITICAL');
            expect(alerts[0].reason).toContain('High volume');

            // Verify persistence
            expect(mockCollection).toHaveBeenCalledWith('fraud_alerts');
            expect(mockAddDoc).toHaveBeenCalled();
        });
    });

    describe('Broad Spectrum ACR', () => {
        it('should flag "sped up" / nightcore content', async () => {
            // Mock rule returning a match for 'sped_up'
            mockGetDocs.mockResolvedValueOnce({
                docs: [{
                    data: () => ({
                        type: 'broad_spectrum',
                        pattern: 'sped_up',
                        details: 'Pitch/Tempo shift (+25%)'
                    })
                }]
            });

            const result = await FraudDetectionService.checkBroadSpectrum('my_song_sped_up.wav');

            expect(mockCollection).toHaveBeenCalledWith('content_rules');
            expect(result.safe).toBe(false);
            expect(result.details).toContain('Pitch/Tempo shift (+25%)');
        });

        it('should flag "slowed" content', async () => {
             // Mock rule returning a match for 'slowed'
             mockGetDocs.mockResolvedValueOnce({
                docs: [{
                    data: () => ({
                        type: 'broad_spectrum',
                        pattern: 'slowed',
                        details: 'Pitch/Tempo shift (-20%)'
                    })
                }]
            });

            const result = await FraudDetectionService.checkBroadSpectrum('my_song_slowed_reverb.wav');
            expect(result.safe).toBe(false);
            expect(result.details).toContain('Pitch/Tempo shift (-20%)');
        });

        it('should pass standard files', async () => {
            // Mock empty rules
            mockGetDocs.mockResolvedValue({ docs: [] });

            const result = await FraudDetectionService.checkBroadSpectrum('master_final.wav');
            expect(result.safe).toBe(true);
        });
    });
});
