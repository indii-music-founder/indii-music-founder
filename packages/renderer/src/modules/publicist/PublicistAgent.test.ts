import { describe, it, expect, vi } from 'vitest';
import { PUBLICIST_TOOLS } from './tools';
import { firebaseAI } from '@/services/ai/FirebaseAIService';

// Mock AI Service with alias path
vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateContent: vi.fn().mockResolvedValue({
            response: {
                text: () => JSON.stringify({
                    headline: "Test Headline",
                    content: "Mocked AI Response",
                    contactInfo: "test@example.com",
                    response: "Mocked AI Response",
                    sentimentAnalysis: "Positive",
                    nextSteps: ["Step 1"]
                })
            }
        })
    }
}));

// Mock MemoryService to avoid IndexedDB issues
vi.mock('@/services/agent/MemoryService', () => ({
    memoryService: {
        saveMemory: vi.fn(),
        retrieveRelevantMemories: vi.fn()
    }
}));

describe('PUBLICIST_TOOLS', () => {
    it('write_press_release should return text', async () => {
        const result = await PUBLICIST_TOOLS.write_press_release({
            headline: "Test Headline",
            company_name: "Test Company",
            key_points: ["Point 1", "Point 2"],
            contact_info: "test@example.com"
        });
        expect(result.data.content).toBe("Mocked AI Response");
    });

    it('generate_crisis_response should return text', async () => {
        const result = await PUBLICIST_TOOLS.generate_crisis_response({
            issue: "Test Issue",
            sentiment: "Negative",
            platform: "Twitter"
        });
        expect(result.data.response).toBe("Mocked AI Response");
    });

    it('generate_campaign_assets should return structured campaign kit', async () => {
        // Mock specific response for this call
        const mockCampaign = {
            pressRelease: {
                headline: "New Single Out Now",
                content: "Exciting news...",
                contactInfo: "pr@label.com"
            },
            socialPosts: [
                { platform: "Instagram", content: "Check this out! 🎵", hashtags: ["#NewMusic"] }
            ],
            emailBlast: {
                subject: "For our biggest fans",
                body: "First listen here..."
            }
        };

        (firebaseAI.generateContent as import("vitest").Mock).mockResolvedValueOnce({
            response: {
                text: () => JSON.stringify(mockCampaign)
            }
        });

        const result = await PUBLICIST_TOOLS.generate_campaign_assets({
            trackTitle: "Neon Nights",
            artistName: "Retro Wave",
            releaseDate: "2026-02-01",
            musicalStyle: ["Synthpop", "80s"],
            targetAudience: "Gen Z"
        });

        expect(result.success).toBe(true);
        expect(result.data.pressRelease.headline).toBe("New Single Out Now");
        expect(result.data.socialPosts).toHaveLength(1);
        expect(result.data.emailBlast.subject).toBe("For our biggest fans");
    });
});

