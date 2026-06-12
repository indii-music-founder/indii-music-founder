import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublishingAgent } from './PublishingAgent';
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';

// Mock the prompt import which uses Vite's ?raw
vi.mock('@agents/publishing/prompt.md?raw', () => ({
    default: 'Mock System Prompt'
}));

// Mock AutonomousIntelligence
vi.mock('@/services/intelligence/AutonomousIntelligence', () => {
    return {
        AutonomousIntelligence: {
            generateText: vi.fn().mockResolvedValue('Mock Contract Summary'),
            generateStructuredData: vi.fn().mockResolvedValue({ status: "DraftReady" }),
            handleError: vi.fn((e) => e)
        }
    };
});

describe('PublishingAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should have the correct ID and metadata', () => {
        expect(PublishingAgent.id).toBe('publishing');
        expect(PublishingAgent.name).toBe('Publishing Director');
        expect(PublishingAgent.category).toBe('department');
    });

    describe('register_work', () => {
        it('should validate work draft and return success', async () => {
            const args = {
                title: 'Midnight',
                writers: ['NOVA', 'J. Smith'],
                split: '60/40'
            };
            const result = await PublishingAgent.functions!.register_work(args);
            expect(result.success).toBe(true);
            expect(result.data?.status).toBe('DraftReady');
        });
    });

    describe('analyze_contract', () => {
        it('should summarize contract content', async () => {
            const args = {
                file_data: 'base64data',
                mime_type: 'application/pdf'
            };
            const result = await PublishingAgent.functions!.analyze_contract(args);
            expect(result.success).toBe(true);
            expect(result.data?.summary).toBe('Mock Contract Summary');
        });
    });
});
