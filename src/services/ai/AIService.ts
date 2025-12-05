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

class AIService {
    private apiKey: string;
    private projectId?: string;
    private location?: string;
    private useVertex: boolean;


    constructor() {
        this.apiKey = env.VITE_API_KEY;
        this.projectId = env.VITE_VERTEX_PROJECT_ID;
        this.location = env.VITE_VERTEX_LOCATION;
        this.useVertex = env.VITE_USE_VERTEX;

        if (!this.apiKey && !this.projectId) {
            console.warn("Missing VITE_API_KEY or VITE_VERTEX_PROJECT_ID");
        }
    }

    async generateContent(options: {
        model: string;
        contents: { role: string; parts: any[] } | { role: string; parts: any[] }[];
        config?: Record<string, unknown>;
    }) {
        try {
            const generateContentFn = httpsCallable(functions, 'generateContent');
            const response = await generateContentFn({
                model: options.model,
                contents: options.contents,
                config: options.config
            });
            return wrapResponse(response.data);
        } catch (error: any) {
            throw new Error(`Generate Content Failed: ${error.message}`);
        }
    }

    async generateContentStream(options: {
        model: string;
        contents: { role: string; parts: { text: string }[] }[];
        config?: Record<string, unknown>;
    }) {
        let functionUrl: string;

        if (env.DEV) {
            // Emulator URL
            const projectId = this.projectId || 'architexture-ai-api';
            const region = this.location || 'us-central1';
            functionUrl = `http://127.0.0.1:5001/${projectId}/${region}/generateContentStream`;
        } else {
            // Production URL
            const projectId = this.projectId || 'architexture-ai-api';
            const region = this.location || 'us-central1';
            functionUrl = `https://${region}-${projectId}.cloudfunctions.net/generateContentStream`;
        }

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: options.model,
                contents: options.contents,
                config: options.config
            })
        });

        if (!response.ok) {
            throw new Error(`Generate Content Stream Failed: ${await response.text()}`);
        }

        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        return new ReadableStream({
            async start(controller) {
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n').filter(line => line.trim() !== '');

                        for (const line of lines) {
                            try {
                                const parsed = JSON.parse(line);
                                if (parsed.text) {
                                    controller.enqueue({ text: () => parsed.text });
                                }
                            } catch (e) {
                                console.warn("Failed to parse chunk:", line);
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
            const generateVideoFn = httpsCallable(functions, 'generateVideo');
            const response = await generateVideoFn({
                prompt: options.prompt,
                model: options.model,
                image: options.image,
                config: options.config
            });

            const data = response.data as any;
            const prediction = data.predictions?.[0];

            if (!prediction) throw new Error("No prediction returned from backend");

            return JSON.stringify(prediction);

        } catch (e) {
            console.error("Video Gen Error", e);
            throw e;
        }
    }

    async embedContent(options: {
        model: string;
        content: { role?: string; parts: { text: string }[] };
    }) {
        try {
            const embedContentFn = httpsCallable(functions, 'embedContent');
            const response = await embedContentFn({
                model: options.model,
                content: options.content
            });
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
