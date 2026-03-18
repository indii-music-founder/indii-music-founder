
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LegalTools } from '@/services/agent/tools/LegalTools';
import { LegalService } from '@/services/legal/LegalService';
import { firebaseAI } from '@/services/ai/FirebaseAIService';

// Mock Dependencies
vi.mock('@/services/legal/LegalService', () => ({
    LegalService: {
        saveContract: vi.fn(),
        updateContract: vi.fn(),
        getContracts: vi.fn(),
        getContractById: vi.fn()
    }
}));

vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateContent: vi.fn()
    }
}));

describe('LegalTools Feature', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('draft_contract', () => {
        const validArgs = {
            type: 'Sync License',
            parties: ['Artist', 'Label'],
            terms: 'Exclusive rights for 2 years'
        };

        it('should execute successfully with valid input', async () => {
            // Mock AI response
            (firebaseAI.generateContent as any).mockResolvedValue({
                response: { text: () => '# LEGAL AGREEMENT\n\nDraft content...' }
            });

            // Mock DB response
            (LegalService.saveContract as any).mockResolvedValue('contract-123');

            const result = await LegalTools.draft_contract!(validArgs);

            // Assert Success
            expect(result.success).toBe(true);
            expect(result.data.content).toContain('# LEGAL AGREEMENT');
            expect(result.data.contractId).toBe('contract-123');

            // Assert AI called
            expect(firebaseAI.generateContent).toHaveBeenCalledWith(
                expect.stringContaining('Draft a Sync License between Artist and Label'),
                expect.any(String), // AI_MODELS.TEXT.AGENT is a string
                undefined,
                expect.stringContaining('You are a senior entertainment lawyer')
            );

            // Assert DB called
            expect(LegalService.saveContract).toHaveBeenCalledWith(expect.objectContaining({
                type: 'Sync License',
                parties: ['Artist', 'Label'],
                metadata: { terms: 'Exclusive rights for 2 years' }
            }));
        });

        it('should handle AI service failure gracefully', async () => {
             (firebaseAI.generateContent as any).mockRejectedValue(new Error("AI Service Down"));

             const result = await LegalTools.draft_contract!(validArgs);

             expect(result.success).toBe(false);
             expect(result.error).toBe("AI Service Down");
             expect(result.metadata?.errorCode).toBe('TOOL_EXECUTION_ERROR');
        });

        it('should handle persistence failure (saveContract fails) but still return content', async () => {
             (firebaseAI.generateContent as any).mockResolvedValue({
                response: { text: () => 'Content' }
            });
            (LegalService.saveContract as any).mockRejectedValue(new Error("DB Error"));

            const result = await LegalTools.draft_contract!(validArgs);

            // The tool implementation catches persistence errors and returns success with content but no ID
            expect(result.success).toBe(true);
            expect(result.data.content).toBe('Content');
            expect(result.data.contractId).toBeUndefined();
            expect(result.message).toContain('failed to save');
        });

        // EDGE CASES & VALIDATION (The Harden Part)

        it('should fail if parties is not an array', async () => {
            const invalidArgs = { ...validArgs, parties: "Not an array" as any };

            const result = await LegalTools.draft_contract!(invalidArgs);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Validation Error');
        });

        it('should fail if parties array is empty', async () => {
             const invalidArgs = { ...validArgs, parties: [] };

             const result = await LegalTools.draft_contract!(invalidArgs);

             expect(result.success).toBe(false);
             expect(result.error).toContain('Validation Error');
        });

        it('should fail if type is missing', async () => {
            const invalidArgs = { ...validArgs, type: undefined as any };

            const result = await LegalTools.draft_contract!(invalidArgs);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Validation Error');
        });
    });

    describe('generate_nda', () => {
        it('should call draft_contract with correct parameters', async () => {
            // We can spy on draft_contract or just verify the outcome relies on draft_contract logic
            // Since draft_contract is another property on the same object, mocking it might be tricky depending on how it's called internally.
            // But LegalTools.generate_nda calls LegalTools.draft_contract explicitly.

            const spy = vi.spyOn(LegalTools, 'draft_contract');

            // Mock draft_contract execution to avoid deep AI calls
            spy.mockResolvedValue({ success: true, data: { content: 'NDA Content' } } as any);

            const args = { parties: ['Alice', 'Bob'], purpose: 'Secret Project' };
            await LegalTools.generate_nda(args);

            expect(spy).toHaveBeenCalledWith({
                type: 'Non-Disclosure Agreement',
                parties: ['Alice', 'Bob'],
                terms: expect.stringContaining('Secret Project')
            });
        });
    });
});
