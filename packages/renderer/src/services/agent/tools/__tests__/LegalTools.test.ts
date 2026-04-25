import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LegalTools } from '../LegalTools';
import { GenAI } from '@/services/ai/GenAI';

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

        const result = await LegalTools.generate_nda({
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

        const result = await LegalTools.draft_contract({
            contractType: 'Service',
            parties: ['Company A', 'Vendor B'],
            duration: '1 year'
        });
        expect(result.success).toBe(true);
    });
});
