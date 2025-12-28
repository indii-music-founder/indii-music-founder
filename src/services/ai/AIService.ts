import { env } from '@/config/env';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { endpointService } from '@/core/config/EndpointService';
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
    Candidate,
    PromptFeedback
} from '@/shared/types/ai.dto';
import { AppErrorCode, AppException } from '@/shared/types/errors';

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
}

interface GenerateVideoOptions {
    model: string;
    prompt: string;
    image?: { imageBytes: string; mimeType: string };
    config?: GenerationConfig & {
        aspectRatio?: string;
        durationSeconds?: number;
    };
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
    private readonly apiKey: string;
    private readonly projectId?: string;
    private readonly location?: string;
    private readonly useVertex: boolean;

    constructor() {
        this.apiKey = env.apiKey || '';
        this.projectId = env.projectId;
        this.location = env.location;
        this.useVertex = env.useVertex;

        if (!this.apiKey && !this.projectId) {
            console.warn('[AIService] Missing VITE_API_KEY or VITE_VERTEX_PROJECT_ID');
        }
    }

    /**
     * Generate content using Google Generative AI SDK
     */
    async generateContent(options: GenerateContentOptions): Promise<WrappedResponse> {
        return this.withRetry(async () => {
            try {
                const { GoogleGenerativeAI } = await import('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(this.apiKey);

                const model = genAI.getGenerativeModel({
                    model: options.model,
                    systemInstruction: options.systemInstruction,
                    tools: options.tools as any,
                    ...options.config
                });

                const contents = Array.isArray(options.contents)
                    ? options.contents
                    : [options.contents];

                const result = await model.generateContent({ contents });
                const response = result.response;

                // Map SDK response to our typed structure
                const mappedResponse: GenerateContentResponse = {
                    candidates: response.candidates?.map((c): Candidate => ({
                        content: {
                            role: c.content?.role ?? 'model',
                            parts: (c.content?.parts ?? []).map((p): ContentPart => {
                                if ('text' in p && p.text) {
                                    return { text: p.text };
                                }
                                if ('functionCall' in p && p.functionCall) {
                                    return {
                                        functionCall: {
                                            name: p.functionCall.name,
                                            args: p.functionCall.args as Record<string, unknown>
                                        }
                                    };
                                }
                                return { text: '' };
                            })
                        },
                        finishReason: c.finishReason as Candidate['finishReason'],
                        safetyRatings: c.safetyRatings?.map(r => ({
                            category: r.category,
                            probability: r.probability,
                            blocked: false
                        })),
                        index: c.index
                    })),
                    promptFeedback: response.promptFeedback ? {
                        blockReason: response.promptFeedback.blockReason,
                        safetyRatings: response.promptFeedback.safetyRatings?.map(r => ({
                            category: r.category,
                            probability: r.probability
                        }))
                    } : undefined
                };

                return wrapResponse(mappedResponse);

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
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.withRetry(operation, retries - 1, delay * 2);
            }
            throw error;
        }
    }

    /**
     * Generate content with streaming response
     */
    async generateContentStream(options: GenerateStreamOptions): Promise<ReadableStream<StreamChunk>> {
        const functionUrl = endpointService.getFunctionUrl('generateContentStream');

        const response = await this.withRetry(() => fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: options.model,
                contents: options.contents,
                config: options.config
            })
        }));

        if (!response.ok) {
            console.error(`[AIService] Stream Response Error: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            throw new AppException(
                AppErrorCode.NETWORK_ERROR,
                `Generate Content Stream Failed: ${errorText}`
            );
        }

        if (!response.body) {
            throw new AppException(AppErrorCode.INTERNAL_ERROR, 'No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        return new ReadableStream<StreamChunk>({
            async start(controller) {
                try {
                    let buffer = '';
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                            break;
                        }


                        const chunk = decoder.decode(value, { stream: true });
                        buffer += chunk;
                        const lines = buffer.split('\n');
                        buffer = lines.pop() ?? '';

                        for (const line of lines) {
                            if (line.trim() === '') continue;
                            try {
                                const parsed = JSON.parse(line) as { text?: string };
                                if (parsed.text) {
                                    const text = parsed.text;
                                    controller.enqueue({ text: () => text });
                                }
                            } catch {
                                console.warn('[AIService] Failed to parse stream chunk:', line);
                                if (line.includes('<!DOCTYPE html>')) {
                                    controller.error(new AppException(
                                        AppErrorCode.NETWORK_ERROR,
                                        'Received HTML instead of JSON stream. Proxy or Auth error.'
                                    ));
                                    return;
                                }
                            }
                        }
                    }
                    controller.close();
                } catch (err) {
                    controller.error(err);
                }
            }
        });
    }

    /**
     * Generate video using Vertex AI backend
     */
    async generateVideo(options: GenerateVideoOptions): Promise<string> {
        try {
            const generateVideoFn = httpsCallable<GenerateVideoRequest, GenerateVideoResponse>(
                functions,
                'generateVideo'
            );

            const response = await this.withRetry(() => generateVideoFn({
                prompt: options.prompt,
                model: options.model,
                image: options.image,
                config: options.config,
                apiKey: this.apiKey
            }));

            const prediction = response.data.predictions?.[0];

            if (!prediction) {
                throw new AppException(
                    AppErrorCode.INTERNAL_ERROR,
                    'No prediction returned from video generation backend'
                );
            }

            return JSON.stringify(prediction);

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
            const generateImageFn = httpsCallable<GenerateImageRequest, GenerateImageResponse>(
                functions,
                'generateImageV3'
            );

            const response = await this.withRetry(() => generateImageFn({
                model: options.model,
                prompt: options.prompt,
                config: options.config,
                apiKey: this.apiKey
            }));

            const images = response.data.images;
            if (!images || images.length === 0) {
                throw new AppException(
                    AppErrorCode.INTERNAL_ERROR,
                    'No images returned from backend'
                );
            }

            return images[0].bytesBase64Encoded;

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
            const embedContentFn = httpsCallable<
                { model: string; content: Content; apiKey: string },
                { embedding: { values: number[] } }
            >(functions, 'embedContent');

            const response = await this.withRetry(() => embedContentFn({
                model: options.model,
                content: options.content,
                apiKey: this.apiKey
            }));

            return response.data.embedding;

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
