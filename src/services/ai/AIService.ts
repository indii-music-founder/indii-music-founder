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

    async generateContent(options: {
        model: string;
        contents: { role: string; parts: any[] } | { role: string; parts: any[] }[];
        config?: Record<string, unknown>;
    }) {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(this.apiKey);

        // Extract top-level parameters from config
        const { systemInstruction, tools, toolConfig, safetySettings, thinkingConfig, ...generationConfig } = options.config || {};

        const model = genAI.getGenerativeModel({
            model: options.model,
            systemInstruction: systemInstruction as any,
            tools: tools as any,
            toolConfig: toolConfig as any,
            safetySettings: safetySettings as any,
            // @ts-expect-error - thinkingConfig might not be in types yet
            thinkingConfig: thinkingConfig as any,
            generationConfig: generationConfig as any
        });

        const contents = Array.isArray(options.contents) ? options.contents : [options.contents];

        const result = await model.generateContent({
            contents: contents as any
        });

        return result.response;
    }

    async generateContentStream(options: {
        model: string;
        contents: { role: string; parts: { text: string }[] }[];
        config?: Record<string, unknown>;
    }) {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(this.apiKey);

        // Extract top-level parameters from config
        const { systemInstruction, tools, toolConfig, safetySettings, thinkingConfig, ...generationConfig } = options.config || {};

        const model = genAI.getGenerativeModel({
            model: options.model,
            systemInstruction: systemInstruction as any,
            tools: tools as any,
            toolConfig: toolConfig as any,
            safetySettings: safetySettings as any,
            // @ts-expect-error - thinkingConfig might not be in types yet
            thinkingConfig: thinkingConfig as any,
            generationConfig: generationConfig as any
        });

        const result = await model.generateContentStream({
            contents: options.contents as any
        });

        return result.stream;
    }

    async generateVideo(options: {
        model: string;
        prompt: string;
        image?: { imageBytes: string; mimeType: string };
        config?: Record<string, unknown>;
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

    async embedContent(options: {
        model: string;
        content: { role?: string; parts: { text: string }[] };
    }) {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(this.apiKey);
        const model = genAI.getGenerativeModel({ model: options.model });

        return await model.embedContent({ content: { role: options.content.role || 'user', parts: options.content.parts } });
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
