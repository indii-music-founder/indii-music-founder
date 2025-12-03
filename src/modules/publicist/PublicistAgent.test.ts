import { describe, it, expect, vi } from 'vitest';
import { PublicistAgent } from '../../services/agent/specialists/PublicistAgent';
import { PUBLICIST_TOOLS } from './tools';

// Mock AI Service
vi.mock('../../services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn().mockResolvedValue({
            text: () => "Mocked AI Response"
        })
    }
}));

// Mock MemoryService to avoid IndexedDB issues
vi.mock('../../services/agent/MemoryService', () => ({
    memoryService: {
        saveMemory: vi.fn(),
        retrieveRelevantMemories: vi.fn()
    }
}));

describe('PublicistAgent', () => {
    it('should be instantiated with correct properties', () => {
        const agent = new PublicistAgent();
        expect(agent.id).toBe('publicist');
        expect(agent.name).toBe('Publicist');
        expect(agent.description).toContain('press releases');
    });
});

describe('PUBLICIST_TOOLS', () => {
    it('write_press_release should return text', async () => {
        const result = await PUBLICIST_TOOLS.write_press_release({
            headline: "Test Headline",
            company_name: "Test Company",
            key_points: ["Point 1", "Point 2"],
            contact_info: "test@example.com"
        });
        expect(result).toBe("Mocked AI Response");
    });

    it('generate_crisis_response should return text', async () => {
        const result = await PUBLICIST_TOOLS.generate_crisis_response({
            issue: "Test Issue",
            sentiment: "Negative",
            platform: "Twitter"
        });
        expect(result).toBe("Mocked AI Response");
    });
});
