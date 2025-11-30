import { GoogleGenAI } from '@google/genai';

// Helper to clean JSON (remove markdown blocks)
function cleanJSON(text: string): string {
    return text.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();
}

class AIService {
    private apiKey: string;
    private projectId?: string;
    private location?: string;
    private useVertex: boolean;

    constructor() {
        // Support both Vite env and legacy process.env if needed
        this.apiKey = import.meta.env.VITE_API_KEY || (window as any).process?.env?.API_KEY || '';
        this.projectId = import.meta.env.VITE_VERTEX_PROJECT_ID;
        this.location = import.meta.env.VITE_VERTEX_LOCATION || 'us-central1';
        this.useVertex = import.meta.env.VITE_USE_VERTEX === 'true';

        if (!this.apiKey && !this.projectId) {
            console.warn("Missing VITE_API_KEY or VITE_VERTEX_PROJECT_ID");
        }
    }

    private getClient() {
        if (this.useVertex && this.projectId) {
            // Vertex AI Client
            console.log("Using Vertex AI with Project:", this.projectId);
            return new GoogleGenAI({
                vertexai: true,
                project: this.projectId,
                location: this.location || 'us-central1',
                apiKey: this.apiKey
            });
        }

        if (!this.apiKey) throw new Error("API Key not found. Please set VITE_API_KEY in .env");
        // Veo 3.1 is likely in v1alpha, but Gemini models need v1beta
        return new GoogleGenAI({ apiKey: this.apiKey, apiVersion: 'v1beta' });
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

    async generateContentStream(options: {
        model: string;
        contents: any;
        config?: any;
        systemInstruction?: string;
    }) {
        const ai = this.getClient();
        const config = options.config || {};
        if (options.systemInstruction) config.systemInstruction = options.systemInstruction;

        return await ai.models.generateContentStream({
            model: options.model,
            contents: options.contents,
            config: config
        });
    }

    async embedContent(options: {
        model: string;
        content: any;
    }) {
        const ai = this.getClient();
        return await ai.models.embedContent({
            model: options.model,
            contents: options.content
        });
    }

    async generateVideo(options: {
        model: string;
        prompt: string;
        image?: { imageBytes: string; mimeType: string };
        config?: any;
    }) {
        // Call Firebase Cloud Function
        // In development, this might need to point to localhost if emulators are running,
        // or the deployed URL.
        const projectId = this.projectId || 'architexture-ai-api';
        const location = 'us-central1';
        const functionUrl = import.meta.env.VITE_FUNCTIONS_URL || `https://${location}-${projectId}.cloudfunctions.net/generateVideo`;

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
