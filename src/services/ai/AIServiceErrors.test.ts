import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AI } from './AIService';
import { firebaseAI } from './FirebaseAIService';
import { AppErrorCode, AppException } from '@/shared/types/errors';

// Mock FirebaseAIService
vi.mock('./FirebaseAIService', () => ({
    firebaseAI: {
        generateContent: vi.fn(),
        generateContentStream: vi.fn()
    }
}));

// Mock others
vi.mock('@/services/firebase', () => ({
    functions: {}
}));

describe('AIService Integration (Client SDK)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should delegate generateContent to firebaseAI and return wrapped response', async () => {
        (firebaseAI.generateContent as any).mockResolvedValue('Hello World');

        const result = await AI.generateContent({
            model: 'gemini-pro',
            contents: [{ role: 'user', parts: [{ text: 'Hi' }] }]
        });

        expect(result.text()).toBe('Hello World');
        expect(firebaseAI.generateContent).toHaveBeenCalledWith([{ role: 'user', parts: [{ text: 'Hi' }] }]);
    });

    it('should map exceptions from firebaseAI to legacy error handling', async () => {
        (firebaseAI.generateContent as any).mockRejectedValue(
            new AppException(AppErrorCode.UNAUTHORIZED, 'Verification Failed')
        );

        await expect(AI.generateContent({
            model: 'gemini-pro',
            contents: []
        })).rejects.toThrow('Verification Failed');
    });

    it('should delegate generateContentStream to firebaseAI', async () => {
        const mockStream = new ReadableStream({
            start(controller) {
                controller.enqueue('Chunk 1');
                controller.close();
            }
        });
        (firebaseAI.generateContentStream as any).mockResolvedValue(mockStream);

        const stream = await AI.generateContentStream({
            model: 'gemini-pro',
            contents: []
        });

        const reader = stream.getReader();
        const { value } = await reader.read();
        expect(value?.text()).toBe('Chunk 1');
    });
});
