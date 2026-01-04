
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

vi.mock('@/services/StorageService', () => ({
    StorageService: {
        uploadFile: vi.fn().mockResolvedValue('https://mock-storage-url.com/image.png'),
        saveItem: vi.fn()
    }
}));

describe('DirectorTools', () => {
    let mockAddToHistory: any;

    beforeEach(() => {
        mockAddToHistory = vi.fn();
        let mockCreateFileNode = vi.fn();

        // Mock global atob and Blob for the helper function if needed, 
        // using Node.js friendly mocks or assuming vitest environment handles it.
        // We can just rely on basic implementation if environment supports it, else mock it.
        // Let's explicitly mock for safety in CI environment.
        global.atob = vi.fn((str) => 'mock-binary-string');
        global.Blob = class {
            size: number;
            constructor(content: any[]) {
                this.size = 100;
            }
        } as any;

        (useStore.getState as any).mockReturnValue({
            addToHistory: mockAddToHistory,
            createFileNode: mockCreateFileNode,
            currentProjectId: 'test-project',
            userProfile: { id: 'test-user' },
            generatedHistory: [],
            setEntityAnchor: vi.fn()
        });

        // Ensure StorageService mocks are set
        // Note: We need to make sure StorageService is properly mocked at import time
        vi.clearAllMocks();
    });

    describe('generate_image', () => {
        it('should return a markdown image with data url', async () => {
            (firebaseAI.generateImage as any).mockResolvedValue('fake-base64-string');

            const result = await DirectorTools.generate_image({ prompt: 'test prompt' });

            // Should contain the persistent URL (mocked)
            expect(result).toContain('![Generated Image](https://mock-storage-url.com/image.png)');

            expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
                type: 'image',
                prompt: 'test prompt',
                url: 'https://mock-storage-url.com/image.png'
            }));
        });

        it('should handle errors gracefully', async () => {
            (firebaseAI.generateImage as any).mockRejectedValue(new Error('AI failed'));
            const result = await DirectorTools.generate_image({ prompt: 'test' });
            expect(result).toContain('Image generation failed');
        });
    });

    describe('generate_high_res_asset', () => {
        it('should generate image, save to history, and return markdown with data url', async () => {
            (firebaseAI.generateImage as any).mockResolvedValue('high-res-base64');

            const result = await DirectorTools.generate_high_res_asset({
                prompt: 'cool design',
                templateType: 'cd_front'
            });

            expect(result).toContain('![High Res Asset](https://mock-storage-url.com/image.png)');
            expect(result).toContain('High-res asset generated for cd_front.');

            // Verify persistence
            expect(mockAddToHistory).toHaveBeenCalledTimes(1);
            expect(mockAddToHistory).toHaveBeenCalledWith(expect.objectContaining({
                type: 'image',
                url: 'https://mock-storage-url.com/image.png',
                prompt: expect.stringContaining('High-Res Asset: cd_front'),
                projectId: 'test-project'
            }));
        });
    });
});
