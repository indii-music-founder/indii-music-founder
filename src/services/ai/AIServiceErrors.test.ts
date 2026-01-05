import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';
import { AI } from './AIService';
import { firebaseAI } from './FirebaseAIService';
import { AppErrorCode, AppException } from '@/shared/types/errors';

vi.mock('@/services/firebase', () => ({
    functions: {},
    ai: {},
    remoteConfig: {}
}));

// Mock FirebaseAIService module
vi.mock('./FirebaseAIService', () => ({
    firebaseAI: {
        generateContent: vi.fn(),
        generateContentStream: vi.fn(),
        generateText: vi.fn(),
        generateStructuredData: vi.fn(),
        analyzeImage: vi.fn(),
        analyzeMultimodal: vi.fn(),
        embedContent: vi.fn(),
    }
}));

describe('AIService Integration (Client SDK)', () => {
    // No need for separate spies variables if we access via imported mock
    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should delegate generateContent to firebaseAI and return wrapped response', async () => {
        vi.mocked(firebaseAI.generateContent).mockResolvedValue({
            response: {
                candidates: [{
                    content: { role: 'model', parts: [{ text: 'Hello World' }] }
                }],
                text: () => 'Hello World'
            }
        } as any);

        const result = await AI.generateContent({
            model: 'gemini-pro',
            contents: [{ role: 'user', parts: [{ text: 'Hi' }] }]
        });

        expect(result.text()).toBe('Hello World');
        expect(firebaseAI.generateContent).toHaveBeenCalledWith(
            expect.arrayContaining([{ role: 'user', parts: [{ text: 'Hi' }] }]),
            'gemini-pro',
            undefined,
            undefined,
            undefined
        );
    });

    it('should map exceptions from firebaseAI to legacy error handling', async () => {
        vi.mocked(firebaseAI.generateContent).mockRejectedValue(
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
        vi.mocked(firebaseAI.generateContentStream).mockResolvedValue(mockStream);

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
