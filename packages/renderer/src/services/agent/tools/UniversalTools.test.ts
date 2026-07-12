import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetContracts, mockGenerateContent } = vi.hoisted(() => ({
    mockGetContracts: vi.fn(),
    mockGenerateContent: vi.fn(),
}));

vi.mock('@/services/legal/LegalService', () => ({
    LegalService: { getContracts: mockGetContracts },
}));

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: { generateContent: mockGenerateContent },
    getResponseText: vi.fn(() => 'Mock legal analysis'),
}));

vi.mock('../fine-tuned-models', () => ({
    getFineTunedModel: vi.fn(() => 'legal-model'),
}));

import { UniversalTools } from './UniversalTools';

/**
 * ISSUE-832: document_query() used to fall back to `contracts[0]` whenever
 * no document matched the requested documentId/path, silently analyzing an
 * unrelated contract instead of failing. These prove it now never
 * substitutes a different document.
 */
describe('UniversalTools.document_query (ISSUE-832)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerateContent.mockResolvedValue({ response: { text: () => 'Mock legal analysis' } });
    });

    it('fails with DOCUMENT_NOT_FOUND instead of substituting the first contract when documentId does not match', async () => {
        mockGetContracts.mockResolvedValue([
            { id: 'contract-1', title: 'Unrelated NDA', content: 'NDA content' },
            { id: 'contract-2', title: 'Another Agreement', content: 'Other content' },
        ]);

        const result = await UniversalTools.document_query!({
            query: 'What is the termination clause?',
            documentId: 'does-not-exist',
        });

        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('DOCUMENT_NOT_FOUND');
        expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('returns DOCUMENT_AMBIGUOUS with candidates instead of guessing when no document was requested and multiple exist', async () => {
        mockGetContracts.mockResolvedValue([
            { id: 'contract-1', title: 'Sync License', content: 'Sync content' },
            { id: 'contract-2', title: 'Split Sheet', content: 'Split content' },
        ]);

        const result = await UniversalTools.document_query!({
            query: 'Summarize my contract',
        });

        expect(result.success).toBe(false);
        expect(result.metadata?.errorCode).toBe('DOCUMENT_AMBIGUOUS');
        expect(result.metadata?.candidates).toEqual([
            { id: 'contract-1', title: 'Sync License' },
            { id: 'contract-2', title: 'Split Sheet' },
        ]);
        expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('analyzes the single contract when no document was requested and exactly one exists (unambiguous)', async () => {
        mockGetContracts.mockResolvedValue([
            { id: 'contract-1', title: 'Only Agreement', content: 'The only content' },
        ]);

        const result = await UniversalTools.document_query!({
            query: 'Summarize my contract',
        });

        expect(result.success).toBe(true);
        expect(result.data.fileName).toBe('Only Agreement');
    });

    it('analyzes the exact match when documentId matches a real contract', async () => {
        mockGetContracts.mockResolvedValue([
            { id: 'contract-1', title: 'Sync License', content: 'Sync content' },
            { id: 'contract-2', title: 'Split Sheet', content: 'Split content' },
        ]);

        const result = await UniversalTools.document_query!({
            query: 'What are the payment terms?',
            documentId: 'contract-2',
        });

        expect(result.success).toBe(true);
        expect(result.data.fileName).toBe('Split Sheet');
    });
});
