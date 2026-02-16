import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LegalTools } from '../LegalTools';

// Note: analyze_contract tests moved to AnalysisTools.test.ts

// Mock FirebaseAIService
const mockGenerateContent = vi.fn();
vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateContent: (args: any) => mockGenerateContent(args)
    }
}));

describe('LegalTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('generate_nda returns generated NDA', async () => {
        mockGenerateContent.mockResolvedValue({
            response: { text: () => '[MOCK] Generated NDA for Alice and Bob' }
        });
        const result = await LegalTools.generate_nda({
            parties: ['Alice', 'Bob'],
            purpose: 'Collaboration'
        });

        expect(result.success).toBe(true);
        expect(result.data.content).toContain('[MOCK] Generated NDA');
        expect(result.data.content).toContain('Alice and Bob');
    });

    it('draft_contract generates contract text', async () => {
        mockGenerateContent.mockResolvedValue({
            response: { text: () => '# LEGAL AGREEMENT\n\nThis agreement is between...' }
        });
        const result = await LegalTools.draft_contract({
            type: 'Sync License',
            parties: ['Artist', 'Label'],
            terms: 'Exclusive rights for 2 years'
        });

        expect(result.data.content).toContain('LEGAL AGREEMENT');
    });
});
