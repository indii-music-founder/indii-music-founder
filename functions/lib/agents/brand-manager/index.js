"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.brandManager = exports.BrandManagerAgent = void 0;
const generative_ai_1 = require("@google/generative-ai");
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
class BrandManagerAgent {
    constructor() {
        this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    }
    async analyzeBrandConsistency(content, guidelines) {
        const prompt = `
            You are a strict Brand Manager. Analyze the following content against the provided brand guidelines.
            
            Brand Guidelines:
            ${guidelines}

            Content to Analyze:
            ${content}

            Provide a JSON response with the following structure:
            {
                "isConsistent": boolean,
                "score": number (0-100),
                "issues": string[],
                "suggestions": string[]
            }
        `;
        const result = await this.model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        try {
            // Clean up markdown code blocks if present
            const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanedText);
        }
        catch (error) {
            console.error("Failed to parse JSON response:", text);
            return {
                isConsistent: false,
                score: 0,
                issues: ["Failed to parse analysis result"],
                suggestions: ["Please try again"]
            };
        }
    }
    async generateBrandAsset(type, prompt) {
        // This would ideally call an image generation model or text generation model depending on type.
        // For now, we'll simulate text asset generation (e.g., slogans, copy) using Gemini.
        // For images, we would use the same Imagen/Vertex AI integration as Creative Director.
        const fullPrompt = `
            You are a creative Brand Manager. Generate a ${type} based on the following prompt, ensuring it aligns with a premium, modern, and visionary brand identity.

            Prompt: ${prompt}

            Return just the content of the asset.
        `;
        const result = await this.model.generateContent(fullPrompt);
        return {
            type,
            content: result.response.text(),
            createdAt: new Date().toISOString()
        };
    }
}
exports.BrandManagerAgent = BrandManagerAgent;
exports.brandManager = new BrandManagerAgent();
//# sourceMappingURL=index.js.map