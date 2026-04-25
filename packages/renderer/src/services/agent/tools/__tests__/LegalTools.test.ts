import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LegalTools } from '../LegalTools';
import { GenAI } from '@/services/ai/GenAI';

vi.mock('@/services/ai/FirebaseAIService', () => {
    const mockFirebaseAI = {
        generateText: vi.fn().mockResolvedValue('Mock AI response'),
        generateContent: vi.fn().mockResolvedValue({ response: { text: () => 'Mock response' } }),
        generateStructuredData: vi.fn().mockResolvedValue({ data: {} }),
        generateImage: vi.fn().mockResolvedValue({ url: 'https://mock-image.png' }),
        analyzeImage: vi.fn().mockResolvedValue({ analysis: {} })
    };
    return {
        FirebaseAIService: class {
            static getInstance() { return mockFirebaseAI; }
        },
        firebaseAI: mockFirebaseAI
    };
});

vi.mock('@/services/ai/GenAI', () => ({
    GenAI: {
        generateContent: vi.fn()
    }
}));

describe('LegalTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('generate_nda returns generated NDA', async () => {
        vi.mocked(GenAI.generateContent).mockResolvedValueOnce({
            response: {
                text: () => JSON.stringify({
                    ndaTitle: "Non-Disclosure Agreement",
                    content: "This NDA...",
                    effectiveDate: "2026-04-24"
                })
            }
        } as any);

        const result = await LegalTools.generate_nda!({
            parties: ['Party A', 'Party B'],
            purpose: 'Business Discussion',
            jurisdiction: 'US'
        });
        expect(result.success).toBe(true);
    });

    it('draft_contract generates contract text', async () => {
        vi.mocked(GenAI.generateContent).mockResolvedValueOnce({
            response: {
                text: () => JSON.stringify({
                    contractTitle: "Service Agreement",
                    content: "Terms and conditions...",
                    keyTerms: ['Payment', 'Duration']
                })
            }
        } as any);

        const result = await LegalTools.draft_contract!({
            type: 'Service',
            parties: ['Company A', 'Vendor B'],
            terms: '1 year duration'
        });
        expect(result.success).toBe(true);
    });
});
