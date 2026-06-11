import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketingAgent } from './MarketingAgent';

// Mock raw prompt import
vi.mock('@agents/marketing/prompt.md?raw', () => ({
    default: 'Mock Marketing Prompt'
}));

// Mock AutonomousIntelligence
vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: {
        generateText: vi.fn().mockResolvedValue('Mock campaign brief or audience analysis')
    }
}));

// Mock AudioIntelligenceService
vi.mock('@/services/audio/AudioIntelligenceService', () => ({
    audioIntelligence: {
        analyze: vi.fn().mockResolvedValue({
            semantic: {
                mood: ['energetic', 'confident'],
                genre: ['hip-hop'],
                marketingHooks: {
                    oneLiner: 'A fresh summer anthem.',
                    keywords: ['summer', 'hype', 'fresh']
                }
            },
            technical: {
                bpm: 120,
                key: 'C Major'
            }
        })
    }
}));

// Mock Zustand store
const mockGetState = vi.fn();
vi.mock('@/core/store', () => ({
    useStore: {
        getState: mockGetState
    }
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MarketingAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('create_campaign_brief', () => {
        it('should successfully create a campaign brief', async () => {
            const { AutonomousIntelligence } = await import('@/services/intelligence/AutonomousIntelligence');
            vi.mocked(AutonomousIntelligence.generateText).mockResolvedValueOnce('Brief text');

            const result = await MarketingAgent.functions!.create_campaign_brief({
                product: 'My Album',
                goal: 'Reach 1M streams'
            });

            expect(result.success).toBe(true);
            expect(result.data).toEqual({ brief: 'Brief text' });
            expect(AutonomousIntelligence.generateText).toHaveBeenCalledWith(
                expect.stringContaining('My Album'),
                expect.any(Object)
            );
        });

        it('should handle failures in brief generation', async () => {
            const { AutonomousIntelligence } = await import('@/services/intelligence/AutonomousIntelligence');
            vi.mocked(AutonomousIntelligence.generateText).mockRejectedValueOnce(new Error('AI error'));

            const result = await MarketingAgent.functions!.create_campaign_brief({
                product: 'My Album',
                goal: 'Reach 1M streams'
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('AI error');
        });
    });

    describe('analyze_audience', () => {
        it('should successfully analyze audience for a platform', async () => {
            const { AutonomousIntelligence } = await import('@/services/intelligence/AutonomousIntelligence');
            vi.mocked(AutonomousIntelligence.generateText).mockResolvedValueOnce('Platform analysis');

            const result = await MarketingAgent.functions!.analyze_audience({
                platform: 'TikTok'
            });

            expect(result.success).toBe(true);
            expect(result.data).toEqual({ analysis: 'Platform analysis' });
            expect(AutonomousIntelligence.generateText).toHaveBeenCalledWith(
                expect.stringContaining('TikTok'),
                expect.any(Object)
            );
        });
    });

    describe('schedule_content', () => {
        it('should return error indicating connection required', async () => {
            const result = await MarketingAgent.functions!.schedule_content({
                posts: []
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('scheduling requires a connected social scheduling backend');
        });
    });

    describe('track_performance', () => {
        it('should return error indicating connected analytics required', async () => {
            const result = await MarketingAgent.functions!.track_performance({
                campaignId: 'campaign-123'
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('performance requires connected analytics data');
        });
    });

    describe('generate_campaign_from_audio', () => {
        it('should return failure if no audio is uploaded in store', async () => {
            mockGetState.mockReturnValue({ uploadedAudio: [] });

            const result = await MarketingAgent.functions!.generate_campaign_from_audio({
                uploadedAudioIndex: 0
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('No audio found');
        });

        it('should successfully fetch, analyze, and return campaign insights from audio', async () => {
            mockGetState.mockReturnValue({
                uploadedAudio: [
                    { id: '1', name: 'song.mp3', url: 'http://localhost/song.mp3' }
                ]
            });

            const mockBlob = {
                type: 'audio/mp3'
            };
            mockFetch.mockResolvedValueOnce({
                blob: vi.fn().mockResolvedValueOnce(mockBlob)
            });

            const result = await MarketingAgent.functions!.generate_campaign_from_audio({
                uploadedAudioIndex: 0
            });

            expect(result.success).toBe(true);
            expect(result.data!.insight).toContain('Genre: hip-hop.Mood: energetic, confident');
            expect(result.data!.suggested_one_liner).toBe('A fresh summer anthem.');
            expect(result.data!.keywords).toEqual(['summer', 'hype', 'fresh']);
            expect(result.data!.technical).toEqual({ bpm: 120, key: 'C Major' });
        });

        it('should handle fetch or analyze failures gracefully', async () => {
            mockGetState.mockReturnValue({
                uploadedAudio: [
                    { id: '1', name: 'song.mp3', url: 'http://localhost/song.mp3' }
                ]
            });

            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await MarketingAgent.functions!.generate_campaign_from_audio({
                uploadedAudioIndex: 0
            });

            expect(result.success).toBe(false);
            expect(result.error).toBe('Network error');
        });
    });
});
