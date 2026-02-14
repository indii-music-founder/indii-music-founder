
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicistService } from './PublicistService';
import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    updateDoc
} from 'firebase/firestore';

// Mocks are already set up in src/test/setup.ts for firebase/firestore
// We access the mocked functions to assert calls

describe('PublicistService Integration Tests', () => {
    const mockUserId = 'test-user-123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('subscribeToCampaigns', () => {
        it('should subscribe with correct query', () => {
            const mockCallback = vi.fn();
            const unsubscribe = PublicistService.subscribeToCampaigns(mockUserId, mockCallback);

            expect(collection).toHaveBeenCalledWith(expect.anything(), 'publicist_campaigns');
            expect(where).toHaveBeenCalledWith('userId', '==', mockUserId);
            expect(query).toHaveBeenCalled();
            expect(onSnapshot).toHaveBeenCalled();
            expect(typeof unsubscribe).toBe('function');
        });

        it('should handle snapshot updates', () => {
            const mockCallback = vi.fn();

            // Mock onSnapshot to immediately trigger callback
            vi.mocked(onSnapshot).mockImplementation((_query: any, next: any) => {
                const mockSnapshot = {
                    docs: [
                        {
                            id: 'camp-1',
                            data: () => ({
                                name: 'Test Campaign',
                                title: 'Test Release',
                                artist: 'Test Artist',
                                status: 'Draft',
                                budget: 1000,
                                userId: mockUserId,
                                type: 'Single', // valid type from schema
                                releaseDate: new Date().toISOString(),
                                openRate: 0,
                                clickRate: 0
                            })
                        }
                    ]
                };
                next(mockSnapshot);
                return vi.fn();
            });

            PublicistService.subscribeToCampaigns(mockUserId, mockCallback);

            expect(mockCallback).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({
                    id: 'camp-1',
                    title: 'Test Release',
                    userId: mockUserId
                })
            ]));
        });
    });

    describe('addCampaign', () => {
        it('should add valid campaign with userId', async () => {
            const newCampaign: any = {
                title: 'New Campaign',
                artist: 'Test Artist',
                status: 'Draft',
                type: 'Single',
                budget: 500,
                releaseDate: new Date().toISOString(),
                targetAudience: 'Global'
            };

            vi.mocked(addDoc).mockResolvedValue({ id: 'new-camp-id' } as any);

            await PublicistService.addCampaign(mockUserId, newCampaign);

            expect(addDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    userId: mockUserId,
                    title: 'New Campaign',
                    artist: 'Test Artist',
                    budget: 500,
                    type: 'Single',
                    status: 'Draft',
                    targetAudience: 'Global',
                    progress: 0,
                    openRate: 0
                })
            );
        });

        it('should throw validation error for invalid campaign', async () => {
            const invalidCampaign: any = {
                name: 123, // Invalid type
                status: 'InvalidStatus'
            };

            await expect(PublicistService.addCampaign(mockUserId, invalidCampaign))
                .rejects.toThrow();
        });
    });

    describe('calculateStats', () => {
        it('should calculate global reach and placement value correctly', () => {
            const campaigns: any[] = [
                { budget: 1000, openRate: 20, status: 'Live' },
                { budget: 2000, openRate: 30, status: 'Completed' }
            ];

            const contacts: any[] = [
                { tier: 'Top' }, // 500k
                { tier: 'Mid' }, // 50k
                { tier: 'Blog' } // 5k
            ];

            const stats = PublicistService.calculateStats(campaigns, contacts);

            // Reach: 500k + 50k + 5k = 555k -> 0.6M or 555k depending on formatter
            // Formatter: >= 1M ? M : >= 1k ? k
            // 555,000 / 1000 = 555k
            expect(stats.globalReach).toBe('555k');

            // Avg Open Rate: (20+30)/2 = 25%
            expect(stats.avgOpenRate).toBe('25%');

            // Placement Value: 1000 + 2000 = 3000 -> $3k
            expect(stats.placementValue).toBe('$3k');
        });

        it('should fallback to estimation if budget is 0 for live campaigns', () => {
            const campaigns: any[] = [
                { budget: 0, openRate: 0, status: 'Live' },
                { budget: 0, openRate: 0, status: 'Live' }
            ];

            // 2 live campaigns * 15000 = 30000 -> $30k
            const stats = PublicistService.calculateStats(campaigns, []);
            expect(stats.placementValue).toBe('$30k');
        });
    });
});
