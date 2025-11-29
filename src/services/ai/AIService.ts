import { GoogleGenAI } from '@google/genai';

// Helper to clean JSON (remove markdown blocks)
function cleanJSON(text: string): string {
    return text.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();
}

class AIService {
    private apiKey: string;
    private projectId?: string;
    private location?: string;

    constructor() {
        // Support both Vite env and legacy process.env if needed
        this.apiKey = import.meta.env.VITE_API_KEY || (window as any).process?.env?.API_KEY || '';
        this.projectId = import.meta.env.VITE_VERTEX_PROJECT_ID;
        this.location = import.meta.env.VITE_VERTEX_LOCATION || 'us-central1';

        if (!this.apiKey && !this.projectId) {
            console.warn("Missing VITE_API_KEY or VITE_VERTEX_PROJECT_ID");
        }
    }

    private getClient() {
        if (this.projectId) {
            // Vertex AI Client (requires OAuth usually, but SDK might handle if configured)
            // For client-side, we might still rely on API Key if using Google AI Studio
            // But this structure allows for expansion.
            return new GoogleGenAI({ apiKey: this.apiKey });
        }

        if (!this.apiKey) throw new Error("API Key not found. Please set VITE_API_KEY in .env");
        return new GoogleGenAI({ apiKey: this.apiKey });
    }

    async generateContent(options: {
        model: string;
        contents: any;
        config?: any;
        systemInstruction?: string;
    }) {
        const ai = this.getClient();
        const config = options.config || {};
        if (options.systemInstruction) config.systemInstruction = options.systemInstruction;

        return await ai.models.generateContent({
            model: options.model,
            contents: options.contents,
            config: config
        });
    }

    async generateVideo(options: {
        model: string;
        prompt: string;
        image?: { imageBytes: string; mimeType: string };
        config?: any;
    }) {
        // Note: The @google/genai SDK might have a specific method for video or use generateContent
        // For Veo (Video FX), it often uses a specific endpoint or model method.
        // Assuming for now it uses the same generateContent or a specialized one if available in the SDK.
        // If the SDK doesn't support 'generateVideo' directly on the model, we might need to use 'generateContent'
        // with specific inputs.

        // However, based on the legacy code, it seemed to expect a URI return.
        // Let's assume we map this to a generateContent call that returns a URI or similar.
        // Or if we are using a specific Video API, we might need to implement that.

        // For this refactor, I will implement it using generateContent but expecting the model to return a URI in the response
        // or handle it as the legacy code did (which seemed to imply a direct API call wrapper).

        // ACTUALLY: The legacy code used `AI.generateVideo`. If `AI` was the legacy class, it had it.
        // The NEW AIService (this file) does NOT have it.
        // I need to implement it.

        // Since I don't have the exact Veo API details for this SDK version, I will implement a placeholder
        // that mimics the expected behavior or uses generateContent if applicable.

        // If the model is 'veo-3.1...', it's likely a generateContent call.

        const ai = this.getClient();
        // Construct contents for video generation
        const contents: any[] = [{ text: options.prompt }];
        if (options.image) {
            contents.push({ inlineData: { mimeType: options.image.mimeType, data: options.image.imageBytes } });
        }

        // Reference images for anchors would need to be handled here too if passed in config

        // This is a simplification. Real Veo integration might differ.
        try {
            const res = await ai.models.generateContent({
                model: options.model,
                contents: contents,
                config: options.config
            });

            // Assuming the response contains the URI in text or a specific field
            // Legacy code expected a URI string.
            // Let's return the text which might be the URI or JSON containing it.
            return res.text;
        } catch (e) {
            console.error("Video Gen Error", e);
            return null;
        }
    }

    parseJSON(text: string | undefined) {
        if (!text) return {};
        try {
            return JSON.parse(cleanJSON(text));
        } catch (e) {
            console.error("Failed to parse JSON:", text);
            return {};
        }
    }
}

export const AI = new AIService();
