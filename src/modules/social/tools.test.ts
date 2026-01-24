import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SOCIAL_TOOLS } from './tools';
import { AI } from '../../services/ai/AIService';
import { SchemaType } from 'firebase/ai';

// Mock AIService
vi.mock('../../services/ai/AIService', () => ({
    AI: {
        generateStructuredData: vi.fn(),
        generateContent: vi.fn()
    }
}));

describe('SOCIAL_TOOLS', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('generate_social_identity', () => {
        it('should call AI.generateStructuredData with correct parameters', async () => {
            const mockResponse = {
                handles: ['@test1', '@test2'],
                bios: ['Bio 1', 'Bio 2']
            };

            (AI.generateStructuredData as any).mockResolvedValue(mockResponse);

            const args = {
                brand_name: 'TestBrand',
                platform: 'Twitter',
                industry: 'Tech'
            };

            const result = await SOCIAL_TOOLS.generate_social_identity(args);

            expect(AI.generateStructuredData).toHaveBeenCalledWith(
                expect.stringContaining('TestBrand'),
                expect.objectContaining({
                    type: SchemaType.OBJECT,
                    required: ['handles', 'bios']
                }),
                undefined,
                undefined
            );

            expect(result).toEqual(mockResponse);
        });

        it('should throw error if AI fails', async () => {
            (AI.generateStructuredData as any).mockRejectedValue(new Error('AI Error'));

            const args = {
                brand_name: 'TestBrand',
                platform: 'Twitter',
                industry: 'Tech'
            };

            await expect(SOCIAL_TOOLS.generate_social_identity(args)).rejects.toThrow('AI Error');
        });
    });
});
