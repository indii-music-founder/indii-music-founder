import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinanceTools } from '../FinanceTools';
import { AI_MODELS } from '@/core/config/ai-models';

// Mock Dependencies
vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateContent: vi.fn()
    }
}));

vi.mock('@/core/config/distributors', () => ({
    DISTRIBUTORS: {
        'distrokid': {
            name: 'DistroKid',
            ddexPartyId: 'PADPIDA2013021901W'
        },
        'tunecore': {
            name: 'TuneCore',
            ddexPartyId: 'PADPIDA2009090203U'
        }
    }
}));

describe('FinanceTools', () => {
    let firebaseAI: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        const module = await import('@/services/ai/FirebaseAIService');
        firebaseAI = module.firebaseAI;
    });

    describe('analyze_receipt', () => {
        it('should successfully analyze a receipt and return parsed data', async () => {
            const mockResponseText = JSON.stringify({
                vendor: 'Office Depot',
                date: '2023-10-27',
                amount: 45.99,
                category: 'Equipment',
                description: 'Printer Paper'
            });

            firebaseAI.generateContent.mockResolvedValue({
                response: {
                    text: () => mockResponseText
                }
            });

            const args = {
                image_data: 'base64encodedimage...',
                mime_type: 'image/jpeg'
            };

            const result = await FinanceTools.analyze_receipt(args);

            expect(firebaseAI.generateContent).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        role: 'user',
                        parts: expect.arrayContaining([
                            expect.objectContaining({ inlineData: { mimeType: args.mime_type, data: args.image_data } })
                        ])
                    })
                ]),
                AI_MODELS.TEXT.AGENT
            );

            expect(result).toEqual(expect.objectContaining({
                success: true,
                data: {
                    raw_data: mockResponseText,
                    message: 'Receipt analysis completed.'
                }
            }));
        });

        it('should handle AI errors gracefully via wrapTool', async () => {
            firebaseAI.generateContent.mockRejectedValue(new Error('AI Error'));

            const args = {
                image_data: 'data',
                mime_type: 'image/png'
            };

            const result = await FinanceTools.analyze_receipt(args);

            expect(result.success).toBe(false);
            expect(result.error).toBe('AI Error');
            expect(result.metadata?.errorCode).toBe('TOOL_EXECUTION_ERROR');
        });
    });

    describe('audit_distribution', () => {
        it('should return success for a valid distributor (Happy Path)', async () => {
            const args = {
                trackTitle: 'My Song',
                distributor: 'distrokid'
            };

            const result = await FinanceTools.audit_distribution(args);

            expect(result).toEqual(expect.objectContaining({
                success: true,
                data: {
                    status: 'READY_FOR_AUDIT',
                    distributor: 'DistroKid',
                    party_id: 'PADPIDA2013021901W',
                    message: expect.stringContaining("Distribution channel 'DistroKid' verified")
                }
            }));
        });

        it('should return failure for an invalid distributor (Input Sanitizer)', async () => {
            const args = {
                trackTitle: 'My Song',
                distributor: 'unknown_distributor'
            };

            const result = await FinanceTools.audit_distribution(args);

            expect(result).toEqual(expect.objectContaining({
                success: false,
                error: "Distributor 'unknown_distributor' is not in the approved database.",
                metadata: expect.objectContaining({
                    errorCode: 'UNKNOWN_DISTRIBUTOR'
                })
            }));
        });
    });
});
