// Helper to clean JSON (remove markdown blocks)
function cleanJSON(text: string): string {
    return text.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();
}

// Helper to wrap raw JSON response to match GoogleGenerativeAI SDK response format
function wrapResponse(rawResponse: any) {
    return {
        response: rawResponse,
        text: () => {
            if (rawResponse.candidates && rawResponse.candidates.length > 0) {
                const candidate = rawResponse.candidates[0];
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    return candidate.content.parts[0].text;
                }
            }
            return "";
        },
        functionCalls: () => {
            if (rawResponse.candidates && rawResponse.candidates.length > 0) {
                const candidate = rawResponse.candidates[0];
                if (candidate.content && candidate.content.parts) {
                    return candidate.content.parts
                        .filter((p: any) => p.functionCall)
                        .map((p: any) => p.functionCall);
                }
            }
            return [];
        }
    };
}

import { env } from '@/config/env';
import { functions } from '@/services/firebase';
import { httpsCallable } from 'firebase/functions';
import { endpointService } from '@/core/config/EndpointService';
import { GenerateContentRequest, GenerateContentResponse, GenerateVideoRequest, GenerateVideoResponse, GenerateImageRequest, GenerateImageResponse } from '@/shared/types/ai.dto';
import { AppErrorCode } from '@/shared/types/errors';

export class AIService {
    private apiKey: string;
    private projectId?: string;
    private location?: string;
    private useVertex: boolean;


    constructor() {
        this.apiKey = env.apiKey;
        this.projectId = env.projectId;
        this.location = env.location;
        this.useVertex = env.useVertex;

        if (!this.apiKey && !this.projectId) {
            console.warn("Missing VITE_API_KEY or VITE_VERTEX_PROJECT_ID");
        }
    }

    async generateContent(options: {
        model: string;
        contents: { role: string; parts: any[] } | { role: string; parts: any[] }[];
        config?: Record<string, unknown>;
        systemInstruction?: string;
        tools?: any[];
    }) {
        return this.withRetry(async () => {
            try {
                // EMERGENCY PIVOT: Backend is broken/missing. Using Client SDK directly.
                const { GoogleGenerativeAI } = await import("@google/generative-ai");
                const genAI = new GoogleGenerativeAI(this.apiKey);

                const model = genAI.getGenerativeModel({
                    model: options.model,
                    systemInstruction: options.systemInstruction,
                    tools: options.tools,
                    ...options.config // formatting safety 
                });

                // The SDK expects contents in a specific format.
                // Our internal format is compatible, but let's ensure type safety if needed.
                // Wrap contents in a request object to match the GenerateContentRequest interface
                // required by the Google Generative AI SDK for multi-turn history.
                const generateRequest = {
                    contents: Array.isArray(options.contents) ? options.contents : [options.contents]
                };

                const result = await model.generateContent(generateRequest as any);
                const response = await result.response;

                // The SDK returns a helper object, but our wrapResponse expects the raw data structure.
                // We can extract the raw candidates from the response object.
                // response.candidates is accessible.

                return wrapResponse({
                    candidates: response.candidates,
                    promptFeedback: response.promptFeedback
                });

            } catch (error: any) {
                console.error("Generate Content (Client SDK) Failed:", error);
                throw new Error(`Generate Content Failed: ${error.message}`);
            }
        });
    }

    private async withRetry<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
        try {
            return await operation();
        } catch (error: any) {
            // Check for retryable errors: 429 (Resource Exhausted), 503 (Unavailable), or specific app codes
            const isRetryable =
                error.code === 'resource-exhausted' ||
                error.code === 'unavailable' ||
                error.message.includes('QUOTA_EXCEEDED') ||
                error.message.includes('503') ||
                error.message.includes('429');

            if (retries > 0 && isRetryable) {
                console.warn(`[AIService] Operation failed, retrying in ${delay}ms... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.withRetry(operation, retries - 1, delay * 2); // Exponential backoff
            }
            throw error;
        }
    }

    async generateContentStream(options: {
        model: string;
        contents: { role: string; parts: { text: string }[] }[];
        config?: Record<string, unknown>;
    }) {
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
            throw new Error(`Generate Content Stream Failed: ${await response.text()}`);
        }

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        return new ReadableStream({
            async start(controller) {
                try {
                    let buffer = '';
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });
                        buffer += chunk;
                        const lines = buffer.split('\n');
                        // Keep the last part in the buffer (it might be incomplete)
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (line.trim() === '') continue;
                            try {
                                const parsed = JSON.parse(line);
                                if (parsed.text) {
                                    controller.enqueue({ text: () => parsed.text });
                                }
                            } catch (e) {
                                console.warn("Failed to parse chunk:", line);
                                // Optional: if we receive HTML error pages (common with proxies), 
                                // we should probably abort.
                                if (line.includes('<!DOCTYPE html>')) {
                                    controller.error(new Error("Received HTML instead of JSON stream. Proxy or Auth error."));
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

    async generateVideo(options: {
        model: string;
        prompt: string;
        image?: { imageBytes: string; mimeType: string };
        config?: Record<string, unknown>;
    }) {
        try {
            const generateVideoFn = httpsCallable<GenerateVideoRequest, GenerateVideoResponse>(functions, 'generateVideo');
            const response = await this.withRetry(() => generateVideoFn({
                prompt: options.prompt,
                model: options.model,
                image: options.image,
                config: options.config,
                apiKey: this.apiKey
            }));

            const data = response.data as any;
            const prediction = data.predictions?.[0];

            if (!prediction) throw new Error("No prediction returned from backend");

            return JSON.stringify(prediction);

        } catch (e) {
            console.error("Video Gen Error", e);
            throw e;
        }
    }

    async generateImage(options: {
        model: string;
        prompt: string;
        config?: Record<string, unknown>;
    }): Promise<string> {
        try {
            const generateImageFn = httpsCallable<GenerateImageRequest, GenerateImageResponse>(functions, 'generateImage');
            const response = await this.withRetry(() => generateImageFn({
                model: options.model,
                prompt: options.prompt,
                config: options.config,
                apiKey: this.apiKey
            }));

            const images = response.data.images;
            if (!images || images.length === 0) {
                throw new Error("No images returned from backend");
            }

            // Return the first image as base64 string
            return images[0].bytesBase64Encoded;
        } catch (e: any) {
            console.error("Image Gen Error", e);
            throw new Error(`Generate Image Failed: ${e.message}`);
        }
    }

    async embedContent(options: {
        model: string;
        content: { role?: string; parts: { text: string }[] };
    }) {
        try {
            const embedContentFn = httpsCallable(functions, 'embedContent');
            const response = await this.withRetry(() => embedContentFn({
                model: options.model,
                content: options.content,
                apiKey: this.apiKey
            }));
            return response.data;
        } catch (error: any) {
            throw new Error(`Embed Content Failed: ${error.message}`);
        }
    }

    parseJSON(text: string | undefined) {
        if (!text) return {};
        try {
            return JSON.parse(cleanJSON(text));
        } catch {
            console.error("Failed to parse JSON:", text);
            return {};
        }
    }
}

export const AI = new AIService();
