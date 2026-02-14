
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { coordinator } from './WorkflowCoordinator';
import { firebaseAI } from '@/services/ai/FirebaseAIService'; // Mocked in setup
import { fileSystemService } from '@/services/FileSystemService';
import { AgentContext } from './types';
import { AI_MODELS } from '@/core/config/ai-models';

// Mock fileSystemService
vi.mock('@/services/FileSystemService', () => ({
    fileSystemService: {
        getProjectNodes: vi.fn(),
        createNode: vi.fn()
    }
}));

// Mock FirebaseAIService
vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: {
        generateContent: vi.fn()
    }
}));

describe('WorkflowCoordinator Integration Tests', () => {

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock FileSystem defaults
        vi.mocked(fileSystemService.getProjectNodes).mockResolvedValue([]);
        vi.mocked(fileSystemService.createNode).mockResolvedValue('folder-id' as any);

        // Mock FirebaseAI response structure
        vi.mocked(firebaseAI.generateContent).mockResolvedValue({
            response: {
                text: () => 'AI Generated Content'
            }
        } as any);
    });

    const mockContext: AgentContext = {
        chatHistory: [],
        userId: 'test-user',
        projectId: 'test-project',
        userProfile: { id: 'test-user', displayName: 'Artist' } as any
    };

    it('should handle simple generation requests via Direct AI', async () => {
        const result = await coordinator.handleUserRequest('Draft a short poem', mockContext);

        expect(result).toBe('AI Generated Content');
        expect(firebaseAI.generateContent).toHaveBeenCalledWith(
            expect.anything(),
            AI_MODELS.TEXT.FAST
        );
    });

    it('should delegate complex planning tasks to Agent', async () => {
        const result = await coordinator.handleUserRequest('Plan a 30-day marketing campaign', mockContext);

        expect(result).toBe('DELEGATED_TO_AGENT');
        expect(firebaseAI.generateContent).not.toHaveBeenCalled();
    });

    it('should delegate tool-requiring tasks (Image Generation) to Agent', async () => {
        const result = await coordinator.handleUserRequest('Generate an image of a neon tiger', mockContext);

        expect(result).toBe('DELEGATED_TO_AGENT');
    });

    it('should delegate file management tasks to Agent', async () => {
        const result = await coordinator.handleUserRequest('Find my contract files', mockContext);

        expect(result).toBe('DELEGATED_TO_AGENT');
    });

    it('should prepare workspace (create Campaign Assets folder)', async () => {
        vi.mocked(fileSystemService.getProjectNodes).mockResolvedValue([]);

        await coordinator.handleUserRequest('Test', mockContext);

        expect(fileSystemService.createNode).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Campaign Assets',
            type: 'folder'
        }));
    });
});
