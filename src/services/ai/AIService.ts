import { GoogleGenAI } from '@google/genai';

// Helper to clean JSON (remove markdown blocks)
function cleanJSON(text: string): string {
    return text.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();
}

class AIService {
    private apiKey: string;

    constructor() {
        // Support both Vite env and legacy process.env if needed
        this.apiKey = import.meta.env.VITE_API_KEY || (window as any).process?.env?.API_KEY || '';
        if (!this.apiKey) {
            console.warn("Missing VITE_API_KEY");
        }
    }

    private getClient() {
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
