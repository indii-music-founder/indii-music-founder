import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinanceTools } from '../FinanceTools';

// Mock FirebaseAIService
const mockGenerateContent = vi.fn();
vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateContent: (...args: any[]) => mockGenerateContent(...args)
    }
}));

describe('FinanceTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('analyze_receipt', () => {
        it('should call AI service with correct prompt and image data', async () => {
            const mockResponseText = JSON.stringify({
                vendor: 'Apple Store',
                date: '2023-10-25',
                amount: 1299.00,
                category: 'Equipment',
                description: 'MacBook Pro'
            });

            mockGenerateContent.mockResolvedValue({
                response: {
                    text: () => mockResponseText
                }
            });

            const args = {
                image_data: 'base64encodedstring...',
                mime_type: 'image/jpeg'
            };

            const result = await FinanceTools.analyze_receipt(args);

            // Verify AI call
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        role: 'user',
                        parts: expect.arrayContaining([
                            expect.objectContaining({ text: expect.stringContaining('You are an expert accountant') }),
                            expect.objectContaining({ inlineData: { mimeType: 'image/jpeg', data: args.image_data } })
                        ])
                    })
                ]),
                expect.anything() // AI Model
            );

            // Verify Result
            expect(result).toEqual(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    raw_data: mockResponseText,
                    message: "Receipt analysis completed."
                })
            }));
        });

        it('should handle AI failures gracefully', async () => {
             mockGenerateContent.mockRejectedValue(new Error('AI Service Down'));

             const args = {
                image_data: 'base64...',
                mime_type: 'image/png'
            };

            const result = await FinanceTools.analyze_receipt(args);

            expect(result).toEqual(expect.objectContaining({
                success: false,
                error: expect.stringContaining('AI Service Down'),
                metadata: expect.objectContaining({
                    errorCode: 'TOOL_EXECUTION_ERROR'
                })
            }));
        });
    });

    describe('audit_distribution', () => {
        it('should return success for a valid distributor (Happy Path)', async () => {
            const args = {
                trackTitle: 'Test Track',
                distributor: 'distrokid'
            };

            const result = await FinanceTools.audit_distribution(args);

            expect(result).toEqual(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    status: 'READY_FOR_AUDIT',
                    distributor: 'DistroKid',
                    party_id: 'PADPIDA2013021901W'
                })
            }));
        });

        it('should return failure for an invalid distributor (Input Sanitizer)', async () => {
            const args = {
                trackTitle: 'Test Track',
                distributor: 'fake_distributor_123'
            };

            const result = await FinanceTools.audit_distribution(args);

            expect(result).toEqual(expect.objectContaining({
                success: false,
                error: expect.stringContaining("Distributor 'fake_distributor_123' is not in the approved database"),
                metadata: expect.objectContaining({
                    errorCode: 'UNKNOWN_DISTRIBUTOR'
                })
            }));
        });
    });
});
