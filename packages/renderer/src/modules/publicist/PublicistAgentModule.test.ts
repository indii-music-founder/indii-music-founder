import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUBLICIST_TOOLS } from './tools';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

// Mock MemoryService to avoid IndexedDB issues
vi.mock('@/services/agent/MemoryService', () => ({
    memoryService: {
        saveMemory: vi.fn(),
        retrieveRelevantMemories: vi.fn()
    }
}));

describe('PUBLICIST_TOOLS', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('write_press_release should return text', async () => {
        vi.spyOn(AutonomousIntelligence, 'generateContent').mockResolvedValueOnce({
            response: {
                text: () => JSON.stringify({
                    headline: "Test Headline",
                    content: "Mocked Press Release content",
                    contactInfo: "test@example.com"
                }),
                inlineDataParts: [],
                functionCalls: [],
                thoughtSummary: ''
            }
        } as any);
        const result = await PUBLICIST_TOOLS.write_press_release({
            headline: "Test Headline",
            company_name: "Test Company",
            key_points: ["Point 1", "Point 2"],
            contact_info: "test@example.com"
        });
        expect(result.success).toBe(true);
    });

    it('generate_crisis_response should return text', async () => {
        vi.spyOn(AutonomousIntelligence, 'generateContent').mockResolvedValueOnce({
            response: {
                text: () => JSON.stringify({
                    response: 'Crisis Response',
                    sentimentAnalysis: 'Negative sentiment detected',
                    nextSteps: ['Step 1', 'Step 2']
                }),
                inlineDataParts: [],
                functionCalls: [],
                thoughtSummary: ""
            }
        } as any);

        const result = await PUBLICIST_TOOLS.generate_crisis_response({
            issue: "Test Issue",
            sentiment: "Negative",
            platform: "Twitter"
        });
        expect(result.success).toBe(true);
    });

    it('generate_campaign_assets should return structured campaign kit', async () => {
        // ISSUE-931: the model is never asked for (and never returns)
        // contactInfo — it drafts headline/content only.
        const mockCampaign = {
            pressRelease: {
                headline: "New Single Out Now",
                content: "Exciting news..."
            },
            socialPosts: [
                { platform: "Instagram", content: "Check this out! 🎵", hashtags: ["#NewMusic"] }
            ],
            emailBlast: {
                subject: "For our biggest fans",
                body: "First listen here..."
            }
        };

        vi.spyOn(AutonomousIntelligence, 'generateContent').mockResolvedValueOnce({
            response: {
                text: () => JSON.stringify(mockCampaign),
                inlineDataParts: [],
                functionCalls: [],
                thoughtSummary: ""
            }
        } as any);

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

    it('ISSUE-931: generate_campaign_assets never lets the model invent contact info', async () => {
        const mockCampaign = {
            pressRelease: { headline: "New Single Out Now", content: "Exciting news..." },
            socialPosts: [{ platform: "Instagram", content: "🎵", hashtags: [] }],
            emailBlast: { subject: "x", body: "y" }
        };

        vi.spyOn(AutonomousIntelligence, 'generateContent').mockResolvedValue({
            response: {
                text: () => JSON.stringify(mockCampaign),
                inlineDataParts: [],
                functionCalls: [],
                thoughtSummary: ""
            }
        } as any);

        const withoutContact = await PUBLICIST_TOOLS.generate_campaign_assets({
            trackTitle: "Neon Nights", artistName: "Retro Wave", releaseDate: "2026-02-01",
            musicalStyle: ["Synthpop"], targetAudience: "Gen Z"
        });
        expect(withoutContact.data.pressRelease.contactInfo).toMatch(/NOT PROVIDED/);

        const withContact = await PUBLICIST_TOOLS.generate_campaign_assets({
            trackTitle: "Neon Nights", artistName: "Retro Wave", releaseDate: "2026-02-01",
            musicalStyle: ["Synthpop"], targetAudience: "Gen Z", contactInfo: "Jane Doe, press@label.com"
        });
        expect(withContact.data.pressRelease.contactInfo).toBe("Jane Doe, press@label.com");
    });

    it('ISSUE-931: generate_campaign_assets ignores a contactInfo the model tries to smuggle into the JSON', async () => {
        vi.spyOn(AutonomousIntelligence, 'generateContent').mockResolvedValueOnce({
            response: {
                text: () => JSON.stringify({
                    pressRelease: { headline: "H", content: "C", contactInfo: "fabricated@fake.com" },
                    socialPosts: [],
                    emailBlast: { subject: "s", body: "b" }
                }),
                inlineDataParts: [],
                functionCalls: [],
                thoughtSummary: ""
            }
        } as any);

        const result = await PUBLICIST_TOOLS.generate_campaign_assets({
            trackTitle: "T", artistName: "A", releaseDate: "2026-02-01",
            musicalStyle: ["Pop"], targetAudience: "Fans", contactInfo: "Real Contact, real@label.com"
        });

        expect(result.data.pressRelease.contactInfo).toBe("Real Contact, real@label.com");
    });
});

