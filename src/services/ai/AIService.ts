import {
    Content,
    ContentPart,
    TextPart,
    FunctionCallPart,
    GenerateContentResponse,
    GenerateVideoRequest,
    GenerateVideoResponse,
    GenerateImageRequest,
    GenerateImageResponse,
    GenerationConfig,
    ToolConfig,
    WrappedResponse,
    Candidate
} from '@/shared/types/ai.dto';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { delay as asyncDelay } from '@/utils/async';
import { firebaseAI } from './FirebaseAIService';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Removes markdown code block wrappers from JSON strings
 */
function cleanJSON(text: string): string {
    return text.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();
}

/**
 * Type guard to check if a content part is a TextPart
 */
function isTextPart(part: ContentPart): part is TextPart {
    return 'text' in part;
}

/**
 * Type guard to check if a content part is a FunctionCallPart
 */
function isFunctionCallPart(part: ContentPart): part is FunctionCallPart {
    return 'functionCall' in part;
}

/**
 * Wraps raw API response to provide consistent accessor methods
 */
function wrapResponse(rawResponse: GenerateContentResponse): WrappedResponse {
    return {
        response: rawResponse,
        text: (): string => {
            const candidates = rawResponse.candidates;
            if (candidates && candidates.length > 0) {
                const candidate = candidates[0];
                if (candidate.content?.parts?.length > 0) {
                    const firstPart = candidate.content.parts[0];
                    if (isTextPart(firstPart)) {
                        return firstPart.text;
                    }
                }
            }
            return '';
        },
        functionCalls: (): FunctionCallPart['functionCall'][] => {
            const candidates = rawResponse.candidates;
            if (candidates && candidates.length > 0) {
                const candidate = candidates[0];
                if (candidate.content?.parts) {
                    return candidate.content.parts
                        .filter(isFunctionCallPart)
                        .map((p) => p.functionCall);
                }
            }
            return [];
        }
    };
}

// ============================================================================
// Types for AIService
// ============================================================================

interface GenerateContentOptions {
    model: string;
    contents: Content | Content[];
    config?: GenerationConfig;
    systemInstruction?: string;
    tools?: ToolConfig[];
}

interface GenerateStreamOptions {
    model: string;
    contents: Content[];
    config?: GenerationConfig;
    systemInstruction?: string;
    tools?: ToolConfig[];
}


interface GenerateVideoOptions {
    model: string;
    prompt: string;
    image?: { imageBytes: string; mimeType: string };
    config?: GenerationConfig & {
        aspectRatio?: string;
        durationSeconds?: number;
    };
    /** Custom timeout in milliseconds. Defaults to calculated based on durationSeconds or 2 minutes minimum. */
    timeoutMs?: number;
}

interface GenerateImageOptions {
    model: string;
    prompt: string;
    config?: GenerationConfig & {
        numberOfImages?: number;
        aspectRatio?: string;
        negativePrompt?: string;
    };
}

interface EmbedContentOptions {
    model: string;
    content: Content;
}

interface StreamChunk {
    text: () => string;
}

interface RetryableError extends Error {
    code?: string;
}

// ============================================================================
// AIService Class
// ============================================================================

export class AIService {
    // Note: AIService delegates generation to FirebaseAIService (Client SDK),
    // which handles Auth and App Check.
    constructor() { }

    /**
     * HIGH LEVEL: Generate text using client-side SDK
     */
    async generateText(prompt: string, thinkingBudget?: number, systemInstruction?: string): Promise<string> {
        return this.withRetry(() => firebaseAI.generateText(prompt, thinkingBudget, systemInstruction));
    }

    /**
     * HIGH LEVEL: Generate structured data using client-side SDK
     */
    async generateStructuredData<T>(prompt: string | any[], schema: any, thinkingBudget?: number, systemInstruction?: string): Promise<T> {
        return this.withRetry(() => firebaseAI.generateStructuredData<T>(prompt, schema, thinkingBudget, systemInstruction));
    }

    /**
     * Generate content using client-side SDK via firebaseAI
     */
    async generateContent(options: GenerateContentOptions): Promise<WrappedResponse> {
        return this.withRetry(async () => {
            try {
                const contents = Array.isArray(options.contents) ? options.contents : [options.contents];
                const result = await firebaseAI.generateContent(
                    contents,
                    options.model,
                    options.config,
                    options.systemInstruction,
                    options.tools
                );

                // Map firebase/ai candidate to legacy Candidate
                const mappedCandidates: Candidate[] = (result.response.candidates || []).map(c => ({
                    content: {
                        role: 'model',
                        parts: (c.content?.parts || []).map(p => {
                            if ('text' in p) return { text: p.text || '' } as TextPart;
                            if ('functionCall' in p) return { functionCall: p.functionCall } as FunctionCallPart;
                            return { text: '' } as TextPart;
                        })
                    },
                    finishReason: (c.finishReason as any) || 'STOP',
                    index: c.index || 0
                }));

                return wrapResponse({
                    candidates: mappedCandidates
                });

            } catch (error) {
                const err = AppException.fromError(error, AppErrorCode.INTERNAL_ERROR);
                console.error('[AIService] Generate Content Failed:', err.message);
                throw err;
            }
        });
    }


    /**
     * Retry logic with exponential backoff for transient errors
     */
    private async withRetry<T>(
        operation: () => Promise<T>,
        retries = 3,
        delay = 1000
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            const err = error as RetryableError;
            const errorMessage = err.message ?? '';

            const isRetryable =
                err.code === 'resource-exhausted' ||
                err.code === 'unavailable' ||
                errorMessage.includes('QUOTA_EXCEEDED') ||
                errorMessage.includes('503') ||
                errorMessage.includes('429');

            if (retries > 0 && isRetryable) {
                console.warn(`[AIService] Operation failed, retrying in ${delay}ms... (${retries} attempts left)`);
                await asyncDelay(delay);
                return this.withRetry(operation, retries - 1, delay * 2);
            }
            throw error;
        }
    }

    /**
     * Generate content with streaming response
     */
    async generateContentStream(options: GenerateStreamOptions): Promise<ReadableStream<StreamChunk>> {
        try {
            const stream = await firebaseAI.generateContentStream(
                options.contents,
                options.model,
                options.config,
                options.systemInstruction,
                options.tools
            );

            const reader = stream.getReader();

            return new ReadableStream<StreamChunk>({
                async start(controller) {
                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            if (value) {
                                controller.enqueue({ text: () => value });
                            }
                        }
                        controller.close();
                    } catch (err) {
                        controller.error(err);
                    }
                }
            });
        } catch (error) {
            console.error('[AIService] Stream Response Error:', error);
            throw AppException.fromError(error, AppErrorCode.NETWORK_ERROR);
        }
    }

    /**
     * Generate video using Vertex AI backend
     */
    /**
     * Generate video using Vertex AI backend (via unified FirebaseAIService)
     */
    async generateVideo(options: GenerateVideoOptions): Promise<string> {
        try {
            return await this.withRetry(() => firebaseAI.generateVideo(options));
        } catch (error) {
            const err = AppException.fromError(error, AppErrorCode.INTERNAL_ERROR);
            console.error('[AIService] Video Gen Error:', err.message);
            throw err;
        }
    }

    /**
     * Generate image using backend function
     */
    async generateImage(options: GenerateImageOptions): Promise<string> {
        try {
            return await this.withRetry(() => firebaseAI.generateImage(
                options.prompt,
                options.model,
                options.config
            ));
        } catch (error) {
            const err = AppException.fromError(error, AppErrorCode.INTERNAL_ERROR);
            console.error('[AIService] Image Gen Error:', err.message);
            throw err;
        }
    }

    /**
     * Generate embeddings for content
     */
    async embedContent(options: EmbedContentOptions): Promise<{ values: number[] }> {
        try {
            return await this.withRetry(() => firebaseAI.embedContent({
                model: options.model,
                content: options.content
            }));
        } catch (error) {
            const err = AppException.fromError(error, AppErrorCode.INTERNAL_ERROR);
            throw new AppException(
                AppErrorCode.INTERNAL_ERROR,
                `Embed Content Failed: ${err.message}`
            );
        }
    }

    /**
     * Parse JSON from AI response, handling markdown code blocks
     */
    parseJSON<T = Record<string, unknown>>(text: string | undefined): T | Record<string, never> {
        if (!text) return {};
        try {
            return JSON.parse(cleanJSON(text)) as T;
        } catch {
            console.error('[AIService] Failed to parse JSON:', text);
            return {};
        }
    }
}

export const AI = new AIService();
