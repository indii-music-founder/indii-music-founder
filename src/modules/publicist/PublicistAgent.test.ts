import { describe, it, expect, vi } from 'vitest';
import { PUBLICIST_TOOLS } from './tools';

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
        const parsed = JSON.parse(result);
        expect(parsed.content).toBe("Mocked AI Response");
    });

    it('generate_crisis_response should return text', async () => {
        const result = await PUBLICIST_TOOLS.generate_crisis_response({
            issue: "Test Issue",
            sentiment: "Negative",
            platform: "Twitter"
        });
        const parsed = JSON.parse(result);
        expect(parsed.response).toBe("Mocked AI Response");
    });
});
