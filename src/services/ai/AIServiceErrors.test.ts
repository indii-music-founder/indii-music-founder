import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';
import { AI } from './AIService';
import { firebaseAI } from './FirebaseAIService';
import { AppErrorCode, AppException } from '@/shared/types/errors';

vi.mock('@/services/firebase', () => ({
    functions: {},
    ai: {},
    remoteConfig: {}
}));

describe('AIService Integration (Client SDK)', () => {
    let generateContentSpy: MockInstance;
    let generateContentStreamSpy: MockInstance;

    beforeEach(() => {
        vi.clearAllMocks();
        // Since we removed the module mock, we spy on the real instance methods
        // Default implementation to return empty object to prevent crashes if test doesn't mock return
        generateContentSpy = vi.spyOn(firebaseAI, 'generateContent').mockImplementation(async () => ({}) as any);
        generateContentStreamSpy = vi.spyOn(firebaseAI, 'generateContentStream').mockImplementation(async () => ({} as any));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should delegate generateContent to firebaseAI and return wrapped response', async () => {
        generateContentSpy.mockResolvedValue({
            response: {
                candidates: [{
                    content: { role: 'model', parts: [{ text: 'Hello World' }] }
                }],
                text: () => 'Hello World'
            }
        });

        const result = await AI.generateContent({
            model: 'gemini-pro',
            contents: [{ role: 'user', parts: [{ text: 'Hi' }] }]
        });

        expect(result.text()).toBe('Hello World');
        expect(generateContentSpy).toHaveBeenCalledWith(
            expect.arrayContaining([{ role: 'user', parts: [{ text: 'Hi' }] }]),
            'gemini-pro',
            undefined,
            undefined,
            undefined
        );
    });

    it('should map exceptions from firebaseAI to legacy error handling', async () => {
        generateContentSpy.mockRejectedValue(
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
                // Return string, as FirebaseAIService does (so AIService wraps it in {text})
                controller.enqueue('Chunk 1');
                controller.close();
            }
        });
        generateContentStreamSpy.mockResolvedValue(mockStream);

        const stream = await AI.generateContentStream({
            model: 'gemini-pro',
            contents: []
        });

        const reader = stream.getReader();
        const { value } = await reader.read();
        expect(value?.text()).toBe('Chunk 1');
    });

    it('should delegate generateText to firebaseAI', async () => {
        const spy = vi.spyOn(firebaseAI, 'generateText').mockResolvedValue('Generated Text');

        const text = await AI.generateText('Prompt', 1000, 'System Instruction');

        expect(text).toBe('Generated Text');
        expect(spy).toHaveBeenCalledWith('Prompt', 1000, 'System Instruction');
    });

    it('should delegate generateStructuredData to firebaseAI', async () => {
        const schema = { type: 'object' };
        const mockData = { key: 'value' };
        // Use any for complex types if needed or exact type
        const spy = vi.spyOn(firebaseAI, 'generateStructuredData').mockResolvedValue(mockData);

        const data = await AI.generateStructuredData('Prompt', schema, 1000, 'System Instruction');

        expect(data).toBe(mockData);
        expect(spy).toHaveBeenCalledWith('Prompt', schema, 1000, 'System Instruction');
    });
});
