
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DirectorTools } from './DirectorTools';
import { useStore } from '@/core/store';
import { firebaseAI } from '@/services/ai/FirebaseAIService';

// Mock dependencies
vi.mock('@/core/store', () => ({
    useStore: {
        getState: vi.fn()
    }
}));

vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateImage: vi.fn(),
        generateContent: vi.fn()
    }
}));

vi.mock('@/services/image/EditingService', () => ({
    Editing: {
        batchEdit: vi.fn(),
        editImage: vi.fn()
    }
}));

describe('DirectorTools', () => {
    let mockAddToHistory: any;

    beforeEach(() => {
        mockAddToHistory = vi.fn();
        (useStore.getState as any).mockReturnValue({
            addToHistory: mockAddToHistory,
            currentProjectId: 'test-project',
            generatedHistory: [],
            setEntityAnchor: vi.fn()
        });
        vi.clearAllMocks();
    });

    describe('generate_image', () => {
        it('should return a summary message and not the base64 string', async () => {
            (firebaseAI.generateImage as any).mockResolvedValue('fake-base64-string');

            const result = await DirectorTools.generate_image({ prompt: 'test prompt' });

            expect(result).toBe('Image generated successfully.');
            expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
                type: 'image',
                prompt: 'test prompt'
            }));
            expect(firebaseAI.generateImage).toHaveBeenCalledWith('test prompt', undefined, expect.any(Object));
        });

        it('should handle errors gracefully', async () => {
            (firebaseAI.generateImage as any).mockRejectedValue(new Error('AI failed'));
            const result = await DirectorTools.generate_image({ prompt: 'test' });
            expect(result).toContain('Image generation failed');
        });
    });

    describe('generate_high_res_asset', () => {
        it('should generate image, save to history, and return summary', async () => {
            (firebaseAI.generateImage as any).mockResolvedValue('high-res-base64');

            const result = await DirectorTools.generate_high_res_asset({
                prompt: 'cool design',
                templateType: 'cd_front'
            });

            expect(result).toBe('High-res asset generated for cd_front.');

            // Verify persistence
            expect(mockAddToHistory).toHaveBeenCalledTimes(1);
            expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
                type: 'image',
                url: 'data:image/png;base64,high-res-base64',
                prompt: expect.stringContaining('High-Res Asset: cd_front'),
                projectId: 'test-project'
            }));
        });
    });
});
