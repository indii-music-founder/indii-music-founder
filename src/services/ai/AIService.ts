import { Schema } from 'firebase/ai';
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
    GenerateSpeechResponse,
    GenerationConfig,
    ToolConfig,
    WrappedResponse,
    Candidate,
    GenerateContentOptions,
    GenerateStreamOptions,
    GenerateVideoOptions,
    GenerateImageOptions,
    EmbedContentOptions,
    StreamChunk,
    RetryableError
} from '@/shared/types/ai.dto';
import { AppErrorCode, AppException } from '@/shared/types/errors';
import { AI_MODELS } from '@/core/config/ai-models';
// import { trace } from '../agent/observability/TraceService';
import { RateLimiter } from './RateLimiter';
import { delay as asyncDelay } from '@/utils/async';
import { firebaseAI } from './FirebaseAIService';
import { AIResponseCache } from './context/AIResponseCache';

const responseCache = new AIResponseCache();

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
// AIService Class
// ============================================================================

export class AIService {
    // Note: AIService delegates generation to FirebaseAIService (Client SDK),
    // which handles Auth and App Check.
    private cache: AIResponseCache;
    private static instance: AIService;
    private activeRequests: Map<string, Promise<WrappedResponse>> = new Map();

    // Default: 60 RPM (adjust based on quota)
    private rateLimiter: RateLimiter = new RateLimiter(60);

    private constructor() {
        this.cache = new AIResponseCache();
    }

    public static getInstance(): AIService {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }

    /**
     * HIGH LEVEL: Generate text using client-side SDK
     */
    async generateText(prompt: string, thinkingBudget?: number, systemInstruction?: string): Promise<string> {
        return this.withRetry(() => firebaseAI.generateText(prompt, thinkingBudget, systemInstruction));
    }

    /**
     * HIGH LEVEL: Generate structured data using client-side SDK
     */
    async generateStructuredData<T>(prompt: string | any[], schema: Schema, thinkingBudget?: number, systemInstruction?: string): Promise<T> {
        return this.withRetry(() => firebaseAI.generateStructuredData<T>(prompt, schema, thinkingBudget, systemInstruction));
    }

    /**
     * Generates content using the Google Gemini model.
     * Includes caching, retries, request coalescing, and rate limiting.
     */
    generateContent(prompt: string | any, options: GenerateContentOptions = {}): Promise<WrappedResponse> {
        // If first argument is an object and not a string/array, treat it as options
        if (typeof prompt === 'object' && prompt !== null && !Array.isArray(prompt)) {
            options = { ...prompt, ...options };
        }

        // Ensure model is set
        const model = options.model || AI_MODELS.TEXT.AGENT;

        // Handle prompt argument if provided (legacy support & convenience)
        let contents = options.contents;
        if (typeof prompt === 'string' && prompt.length > 0) {
            if (!contents) {
                contents = [{ role: 'user', parts: [{ text: prompt }] }];
            }
        }
        // If contents is still undefined, look at prompt as 'any' maybe? 
        // But for typing safety we expect contents to be populated if prompt is not string.
        if (!contents) {
            contents = [];
        }
        if (!Array.isArray(contents)) {
            contents = [contents];
        }

        // Update options with resolved contents for cache key generation
        const effectiveOptions = { ...options, model, contents };

        // 0. Cache Check
        const cacheKey = this.cache.generateKey(effectiveOptions);
        if (!options.skipCache) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                return Promise.resolve(wrapResponse(cached));
            }
        }

        // 1. Request Coalescing
        if (options.cache !== false && cacheKey && this.activeRequests.has(cacheKey)) {
            return this.activeRequests.get(cacheKey)!;
        }

        // Define the Async Operation
        const executeRequest = async (): Promise<WrappedResponse> => {
            // 2. Rate Limiting Acquisition
            await this.rateLimiter.acquire(30000);

            return this.withRetry(async () => {
                // Default timeout: 60s (can be disabled with infinity or customized)
                const timeoutMs = options.timeout ?? 60000;
                const signal = options.signal;

                const generateOp = async () => {
                    try {
                        const result = await firebaseAI.generateContent(
                            contents as Content[], // asserted from above logic
                            model,
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
                            finishReason: (c.finishReason as unknown as 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER') || 'STOP',
                            index: c.index || 0
                        }));

                        if (options.cache !== false && cacheKey) {
                            // Default TTL or from options if added later
                            this.cache.set(cacheKey, result.response, options.cacheTTL);
                        }

                        return wrapResponse({
                            candidates: mappedCandidates
                        });

                    } catch (error: any) {
                        // Pass through retryable errors to be handled by withRetry
                        if (
                            error?.code === 'resource-exhausted' ||
                            error?.code === 'unavailable' ||
                            error?.message?.includes('429') ||
                            error?.message?.includes('503')
                        ) {
                            throw error;
                        }

                        const err = AppException.fromError(error, AppErrorCode.INTERNAL_ERROR);
                        console.error('[AIService] Generate Content Failed:', err.message);
                        throw err;
                    }
                };

                // Implement Race between Generation, Timeout, and AbortSignal
                return new Promise<WrappedResponse>((resolve, reject) => {
                    const timer = setTimeout(() => {
                        reject(new AppException(AppErrorCode.TIMEOUT, `AI Request timed out after ${timeoutMs}ms`));
                    }, timeoutMs);

                    if (signal) {
                        if (signal.aborted) {
                            clearTimeout(timer);
                            return reject(new AppException(AppErrorCode.CANCELLED, 'AI Request cancelled'));
                        }
                        signal.addEventListener('abort', () => {
                            clearTimeout(timer);
                            reject(new AppException(AppErrorCode.CANCELLED, 'AI Request cancelled'));
                        });
                    }

                    generateOp()
                        .then(res => {
                            clearTimeout(timer);
                            resolve(res);
                        })
                        .catch(err => {
                            clearTimeout(timer);
                            reject(err);
                        });
                });
            });
        };

        const requestPromise = executeRequest();

        if (options.cache !== false && cacheKey) {
            this.activeRequests.set(cacheKey, requestPromise);
            // Cleanup pending request after completion (success or error)
            requestPromise.finally(() => {
                if (this.activeRequests.get(cacheKey) === requestPromise) {
                    this.activeRequests.delete(cacheKey);
                }
            }).catch(() => {
                // Ignore errors in the cleanup chain as they are handled by the caller
            });
        }

        return requestPromise;
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
    async generateContentStream(options: GenerateContentOptions): Promise<{ stream: ReadableStream<StreamChunk>, response: Promise<WrappedResponse> }> {
        try {
            await this.rateLimiter.acquire();

            const contents = options.contents ?? [];
            const tools = options.tools ?? [];

            return await firebaseAI.generateContentStream(
                contents as Content[],
                options.model,
                options.config,
                options.systemInstruction,
                tools
            );
        } catch (error) {
            console.error('[AIService] Stream Response Error:', error);
            throw AppException.fromError(error, AppErrorCode.NETWORK_ERROR);
        }
    }

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
     * Generate speech from text using TTS
     */
    async generateSpeech(text: string, voice?: string, modelOverride?: string): Promise<GenerateSpeechResponse> {
        try {
            return await this.withRetry(() => firebaseAI.generateSpeech(text, voice, modelOverride));
        } catch (error) {
            const err = AppException.fromError(error, AppErrorCode.INTERNAL_ERROR);
            console.error('[AIService] Speech Gen Error:', err.message);
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
     * BATCHING: Embed multiple documents in parallel
     */
    async batchEmbedContents(contents: Content[], model?: string): Promise<number[][]> {
        try {
            return await this.withRetry(() => firebaseAI.batchEmbedContents(contents, model));
        } catch (error) {
            const err = AppException.fromError(error, AppErrorCode.INTERNAL_ERROR);
            throw new AppException(
                AppErrorCode.INTERNAL_ERROR,
                `Batch Embed Content Failed: ${err.message}`
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

export const AI = AIService.getInstance();
