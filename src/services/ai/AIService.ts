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
        this.apiKey = import.meta.env.VITE_API_KEY || '';
        this.projectId = import.meta.env.VITE_VERTEX_PROJECT_ID;
        this.location = import.meta.env.VITE_VERTEX_LOCATION || 'us-central1';
        this.useVertex = import.meta.env.VITE_USE_VERTEX === 'true';

        if (!this.apiKey && !this.projectId) {
            console.warn("Missing VITE_API_KEY or VITE_VERTEX_PROJECT_ID");
        }
    }

    // ... (getClient remains the same)

    async generateVideo(options: {
        model: string;
        prompt: string;
        image?: { imageBytes: string; mimeType: string };
        config?: any;
    }) {
        // Call Firebase Cloud Function
        const functionUrl = import.meta.env.VITE_FUNCTIONS_URL;

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
