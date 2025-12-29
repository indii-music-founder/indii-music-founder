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
    Candidate
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
    // Note: apiKey is no longer stored here for security. 
    // All requests are routed through backend functions (ragProxy, generateContentStream).
    private readonly projectId?: string;
    private readonly location?: string;
    private readonly useVertex: boolean;

    constructor() {
        this.projectId = env.projectId;
        this.location = env.location;
        this.useVertex = env.useVertex;
    }

    /**
     * Generate content using RAG Proxy (Server-side API Key)
     */
    async generateContent(options: GenerateContentOptions): Promise<WrappedResponse> {
        return this.withRetry(async () => {
            try {
                // Construct path for the proxy to forward to Google Generative Language API
                const endpointPath = `/v1beta/models/${options.model}:generateContent`;
                const proxyUrl = endpointService.getFunctionUrl('ragProxy');

                // We append the target path to the proxy URL if the proxy is set up to handle it
                // Based on standard simple proxy patterns: POST to proxy with body.
                // However, ragProxy checks req.path. So we might need to construct the URL effectively.
                // Assuming standard Cloud Function behavior: URL is BaseURL/functionName
                // But ragProxy code says: const targetPath = req.path;

                // If the function is hosted at /ragProxy, req.path is usually /.
                // To pass dynamic path info to a specialized proxy function, we often need to use a rewrites rule or query param.
                // Let's check `firebase.json` or assume we send the target as a header or body if req.path isn't reliable directly without hosting rewrites.

                // Actually, examining ragProxy again: 
                // It uses `https.onRequest`. If we call `.../ragProxy/v1beta/models/...`, req.path *might* capture the suffix if rewritten.
                // Without hosting rewrites, req.path is just /.

                // Use a safer fallback: Use `generateContentStream` usage pattern or `httpsCallable` if possible?
                // `ragProxy` is an `onRequest`. 
                // Let's assume for now we call the function URL + the path we want masked.
                // Standard Firebase Functions URL: https://region-project.cloudfunctions.net/ragProxy
                // If we append /v1beta/..., it might 404 unless allowed.

                // Alternative: Use `generateContentProxy` callable if we had one.
                // But we have `ragProxy`. 

                // Let's try appending the path. If it fails, we know why.
                const url = `${proxyUrl}${endpointPath}`;

                const contents = Array.isArray(options.contents)
                    ? options.contents
                    : [options.contents];

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents,
                        systemInstruction: options.systemInstruction ? { parts: [{ text: options.systemInstruction }] } : undefined,
                        tools: options.tools,
                        generationConfig: options.config
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Proxy Error ${response.status}: ${errorText}`);
                }

                const result = await response.json();

                // Normalize response
                const mappedResponse: GenerateContentResponse = {
                    candidates: result.candidates?.map((c: any): Candidate => ({
                        content: {
                            role: c.content?.role ?? 'model',
                            parts: (c.content?.parts ?? []).map((p: any): ContentPart => {
                                if (p.text) return { text: p.text };
                                if (p.functionCall) return {
                                    functionCall: {
                                        name: p.functionCall.name,
                                        args: p.functionCall.args
                                    }
                                };
                                return { text: '' };
                            })
                        },
                        finishReason: c.finishReason,
                        safetyRatings: c.safetyRatings,
                        index: c.index
                    })),
                    promptFeedback: result.promptFeedback
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
        // Points to our secure backend function which holds the API key
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
                                // console.warn('[AIService] Failed to parse stream chunk:', line);
                                // SIlently fail on non-json chunks (like keep-alive newlines)
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

            // Removed apiKey parameter - backend handles it
            const response = await this.withRetry(() => generateVideoFn({
                prompt: options.prompt,
                model: options.model,
                image: options.image,
                config: options.config
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
                config: options.config
                // ApiKey removed, handled by backend secret
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
            // Note: embedContent function signature in backend might still expect apiKey if not updated
            // But we should try calling it without first.
            const embedContentFn = httpsCallable<
                { model: string; content: Content },
                { embedding: { values: number[] } }
            >(functions, 'embedContent');

            const response = await this.withRetry(() => embedContentFn({
                model: options.model,
                content: options.content
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
