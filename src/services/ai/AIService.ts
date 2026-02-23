import { Schema } from 'firebase/ai';
import {
    Content,
    GenerateContentResponse,
    GenerateVideoOptions,
    GenerateImageOptions,
    EmbedContentOptions,
    Candidate,
    WrappedResponse,
    GenerateContentOptions,
    StreamChunk,
    GenerateSpeechResponse
} from '@/shared/types/ai.dto';
import { GenAI } from './GenAI';

/**
 * @deprecated Use GenAI facade instead: `import { GenAI } from '@/services/ai/GenAI'`
 * 
 * Legacy AIService wrapper for backward compatibility during migration.
 * All methods now delegate to GenAI (FirebaseAIService).
 */
export class AIService {
    private static instance: AIService;

    private constructor() { }

    public static getInstance(): AIService {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }

    /** @deprecated Use GenAI.generateText */
    async generateText(prompt: string, thinkingBudget?: number, systemInstruction?: string): Promise<string> {
        return GenAI.generateText(prompt, thinkingBudget, systemInstruction);
    }

    /** @deprecated Use GenAI.generateStructuredData */
    async generateStructuredData<T>(prompt: string | any[], schema: Schema, thinkingBudget?: number, systemInstruction?: string): Promise<T> {
        return GenAI.generateStructuredData<T>(prompt, schema, thinkingBudget, systemInstruction);
    }

    /** @deprecated Use GenAI.generateContent */
    async generateContent(prompt: string | any, options: GenerateContentOptions = {}): Promise<WrappedResponse> {
        // Handle legacy positional arguments if prompt is a string
        if (typeof prompt === 'string' && !options.contents) {
            options.contents = [{ role: 'user', parts: [{ text: prompt }] }];
        }

        const result = await GenAI.generateContent(
            (options.contents || prompt) as string | Content[],
            options.model,
            options.config,
            options.systemInstruction,
            options.tools as any,
            options
        );

        // Map back to legacy WrappedResponse
        return {
            response: result.response as unknown as GenerateContentResponse,
            text: () => result.response.text(),
            functionCalls: () => {
                const parts = result.response.candidates?.[0]?.content?.parts || [];
                return parts
                    .filter(p => 'functionCall' in p)
                    .map(p => (p as any).functionCall);
            },
            usage: () => result.response.usageMetadata
        };
    }

    /** @deprecated Use GenAI.generateContentStream */
    async generateContentStream(options: GenerateContentOptions): Promise<{ stream: ReadableStream<StreamChunk>, response: Promise<WrappedResponse> }> {
        const result = await GenAI.generateContentStream(
            options.contents as Content[],
            options.model,
            options.config,
            options.systemInstruction,
            options.tools as any,
            options
        );

        return result;
    }

    /** @deprecated Use GenAI.generateVideo */
    async generateVideo(options: GenerateVideoOptions): Promise<string> {
        return GenAI.generateVideo(options);
    }

    /** @deprecated Use GenAI.generateImage */
    async generateImage(options: GenerateImageOptions): Promise<string> {
        return GenAI.generateImage(options);
    }

    /** @deprecated Use GenAI.analyzeImage */
    async analyzeImage(prompt: string, imageBase64: string, mimeType: string = 'image/jpeg'): Promise<string> {
        return GenAI.analyzeImage(prompt, imageBase64, mimeType);
    }

    /** @deprecated Use GenAI.generateSpeech */
    async generateSpeech(text: string, voice?: string, modelOverride?: string): Promise<GenerateSpeechResponse> {
        return GenAI.generateSpeech(text, voice, modelOverride);
    }

    /** @deprecated Use GenAI.embedContent */
    async embedContent(options: EmbedContentOptions): Promise<{ values: number[] }> {
        return GenAI.embedContent(options);
    }

    /** @deprecated Use GenAI.batchEmbedContents */
    async batchEmbedContents(contents: Content[], model?: string): Promise<number[][]> {
        return GenAI.batchEmbedContents(contents, model);
    }

    /** @deprecated Use GenAI.parseJSON */
    parseJSON<T = Record<string, unknown>>(text: string | undefined): T | Record<string, never> {
        return GenAI.parseJSON<T>(text);
    }
}

export const AI = AIService.getInstance();
