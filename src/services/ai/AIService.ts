// Helper to clean JSON (remove markdown blocks)
function cleanJSON(text: string): string {
    return text.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();
}

import { env } from '@/config/env';

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
        const functionUrl = `${env.VITE_FUNCTIONS_URL}/generateContent`;

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
            throw new Error(`Generate Content Failed: ${await response.text()}`);
        }

        return await response.json();
    }

    async generateContentStream(options: {
        model: string;
        contents: { role: string; parts: { text: string }[] }[];
        config?: Record<string, unknown>;
    }) {
        const functionUrl = `${env.VITE_FUNCTIONS_URL}/generateContentStream`;

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
        // Call Firebase Cloud Function
        const functionUrl = env.VITE_FUNCTIONS_URL;

        if (!functionUrl) {
            throw new Error("VITE_FUNCTIONS_URL is not defined in environment variables.");
        }

        try {
            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: options.prompt,
                    model: options.model,
                    image: options.image,
                    config: options.config
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Video Generation Failed: ${errText}`);
            }

            const data = await response.json();
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
        const functionUrl = `${env.VITE_FUNCTIONS_URL}/embedContent`;

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: options.model,
                content: options.content
            })
        });

        if (!response.ok) {
            throw new Error(`Embed Content Failed: ${await response.text()}`);
        }

        return await response.json();
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
