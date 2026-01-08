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
import { AI_MODELS } from '@/core/config/ai-models';

// Mock dependencies
vi.mock('@/services/ai/FirebaseAIService', () => ({
  firebaseAI: {
    generateContent: vi.fn()
  }
}));

// Mock dynamic import of DISTRIBUTORS if necessary, or let it use the real one.
// Since the tool does `await import('@/core/config/distributors')`, we can mock the module.
// This ensures we test with known data regardless of external config changes.
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('analyze_receipt', () => {
    it('should successfully analyze a receipt and return parsed data', async () => {
      // Import the mock to configure it
      const { firebaseAI } = await import('@/services/ai/FirebaseAIService');

      const mockResponseText = JSON.stringify({
        vendor: "Office Depot",
        date: "2023-10-27",
        amount: 45.99,
        category: "Equipment",
        description: "Printer Paper"
      });

      // Mock the response structure from generateContent
      (firebaseAI.generateContent as any).mockResolvedValue({
        response: {
          text: () => mockResponseText
        }
      });

      const args = {
        image_data: "base64encodedimage...",
        mime_type: "image/jpeg"
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

      // Verify the wrapTool wrapped the result correctly
      expect(result).toEqual(expect.objectContaining({
        success: true,
        data: {
            raw_data: mockResponseText,
            message: "Receipt analysis completed."
        }
      }));
    });

    it('should handle AI errors gracefully via wrapTool', async () => {
         const { firebaseAI } = await import('@/services/ai/FirebaseAIService');
         (firebaseAI.generateContent as any).mockRejectedValue(new Error("AI Error"));

         const args = {
            image_data: "data",
            mime_type: "image/png"
         };

         const result = await FinanceTools.analyze_receipt(args);

         // wrapTool catches the error and returns success: false
         expect(result.success).toBe(false);
         expect(result.error).toBe("AI Error");
         expect(result.metadata?.errorCode).toBe("TOOL_EXECUTION_ERROR");
    });
  });

  describe('audit_distribution', () => {
    it('should return success for a valid distributor (Happy Path)', async () => {
      const args = {
        trackTitle: "My Song",
        distributor: "distrokid"
      };

      const result = await FinanceTools.audit_distribution(args);

      expect(result).toEqual(expect.objectContaining({
        success: true,
        data: {
            status: "READY_FOR_AUDIT",
            distributor: "DistroKid",
            party_id: "PADPIDA2013021901W",
            message: expect.stringContaining("Distribution channel 'DistroKid' verified")
        }
      }));
    });

    it('should return failure for an invalid distributor (Input Sanitizer)', async () => {
      const args = {
        trackTitle: "My Song",
        distributor: "unknown_distributor"
      };

      const result = await FinanceTools.audit_distribution(args);

      expect(result).toEqual(expect.objectContaining({
        success: false,
        error: "Distributor 'unknown_distributor' is not in the approved database.",
        metadata: expect.objectContaining({
            errorCode: "UNKNOWN_DISTRIBUTOR"
        })
      }));
    });
  });
});
