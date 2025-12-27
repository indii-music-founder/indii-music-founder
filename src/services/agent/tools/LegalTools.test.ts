import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LegalTools } from './LegalTools';

// Note: analyze_contract tests moved to AnalysisTools.test.ts

// Mock AIService
const mockGenerateContent = vi.fn();
vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: (args: any) => mockGenerateContent(args)
    }
}));

describe('LegalTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('generate_nda returns generated NDA', async () => {
        mockGenerateContent.mockResolvedValue({
            text: () => '[MOCK] Generated NDA for Alice and Bob'
        });
        const result = await LegalTools.generate_nda({
            parties: ['Alice', 'Bob'],
            purpose: 'Collaboration'
        });

        expect(result).toContain('[MOCK] Generated NDA');
        expect(result).toContain('Alice and Bob');
    });

    it('draft_contract generates contract text', async () => {
        mockGenerateContent.mockResolvedValue({
            text: () => '# LEGAL AGREEMENT\n\nThis agreement is between...'
        });
        const result = await LegalTools.draft_contract({
            type: 'Sync License',
            parties: ['Artist', 'Label'],
            terms: 'Exclusive rights for 2 years'
        });

        expect(result).toContain('LEGAL AGREEMENT');
    });
});
