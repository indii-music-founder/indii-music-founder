import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from './AIService';
import { firebaseAI } from './FirebaseAIService';

// Mock FirebaseAIService
vi.mock('./FirebaseAIService', () => ({
    firebaseAI: {
        generateContent: vi.fn(),
        generateText: vi.fn(),
        generateStructuredData: vi.fn(),
        generateContentStream: vi.fn(),
        generateVideo: vi.fn(),
        generateImage: vi.fn(),
        generateSpeech: vi.fn(),
        embedContent: vi.fn(),
        batchEmbedContents: vi.fn()
    }
}));

// Mock TokenUsageService and RateLimiter to avoid side effects
vi.mock('./billing/TokenUsageService', () => ({
    TokenUsageService: {
        checkQuota: vi.fn().mockResolvedValue(true),
        checkRateLimit: vi.fn().mockResolvedValue(true),
        trackUsage: vi.fn()
    }
}));

describe('AIService', () => {
    let aiService: AIService;

    beforeEach(() => {
        vi.clearAllMocks();
        // AIService is a singleton, so we get the instance
        aiService = AIService.getInstance();

        // Setup default mock response
        (firebaseAI.generateContent as any).mockResolvedValue({
            response: {
                candidates: [{ content: { parts: [{ text: 'Response' }] } }],
                usageMetadata: {}
            }
        });
    });

    it('should inject thoughtSignature into the last content part', async () => {
        const prompt = 'Test prompt';
        const thoughtSignature = 'test-signature-123';

        await aiService.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            thoughtSignature
        });

        expect(firebaseAI.generateContent).toHaveBeenCalledTimes(1);
        const args = (firebaseAI.generateContent as any).mock.calls[0];
        const contents = args[0];

        expect(contents).toHaveLength(1);
        expect(contents[0].parts).toHaveLength(1);
        expect(contents[0].parts[0]).toMatchObject({
            text: prompt,
            thoughtSignature: thoughtSignature
        });
    });

    it('should inject thoughtSignature when prompt is passed as string', async () => {
        const prompt = 'String prompt';
        const thoughtSignature = 'sig-456';

        // generateContent(prompt, options)
        await aiService.generateContent(prompt, { thoughtSignature });

        expect(firebaseAI.generateContent).toHaveBeenCalledTimes(1);
        const args = (firebaseAI.generateContent as any).mock.calls[0];
        const contents = args[0];

        expect(contents[0].parts[0]).toMatchObject({
            text: prompt,
            thoughtSignature: thoughtSignature
        });
    });

    it('should not inject thoughtSignature if not provided', async () => {
        const prompt = 'No sig';
        await aiService.generateContent(prompt);

        const args = (firebaseAI.generateContent as any).mock.calls[0];
        const contents = args[0];
        expect(contents[0].parts[0]).not.toHaveProperty('thoughtSignature');
    });
});
