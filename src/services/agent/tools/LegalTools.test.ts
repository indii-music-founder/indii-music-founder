
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LegalTools } from './LegalTools';

// Mock Firebase functions
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
    httpsCallable: (functionsInstance: any, name: string) => {
        return (data: any) => mockHttpsCallable(data);
    },
    getFunctions: vi.fn()
}));

vi.mock('@/services/firebase', () => ({
    functions: {}
}));

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

    it('analyze_contract calls cloud function correctly', async () => {
        mockHttpsCallable.mockResolvedValue({
            data: { risk_score: 85, summary: 'Safe contract' }
        });

        const result = await LegalTools.analyze_contract({
            fileData: 'base64data',
            mimeType: 'application/pdf'
        });

        expect(JSON.parse(result)).toEqual({ risk_score: 85, summary: 'Safe contract' });
    });

    it('analyze_contract handles errors gracefully', async () => {
        mockHttpsCallable.mockRejectedValue(new Error('Cloud function failed'));

        const result = await LegalTools.analyze_contract({
            fileData: 'base64data',
            mimeType: 'application/pdf'
        });

        expect(result).toContain('Contract analysis failed');
    });

    it('generate_nda returns mock data (for now)', async () => {
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
});
