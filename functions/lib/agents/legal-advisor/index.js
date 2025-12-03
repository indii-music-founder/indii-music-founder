"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.legalAdvisor = exports.LegalAdvisorAgent = void 0;
const generative_ai_1 = require("@google/generative-ai");
const ai_models_1 = require("../../config/ai-models");
const SYSTEM_INSTRUCTION = `
You are the Legal Advisor for the Rndr-AI platform, an expert in entertainment law, contract analysis, and intellectual property.
Your goal is to help users understand legal documents, identify risks, and ensure they are protected.

Capabilities:
1. **Contract Analysis**: Analyze legal documents (PDF, text) and provide a safety score, summary, and list of risks.
2. **Risk Identification**: Highlight specific clauses that are problematic or unfair.
3. **Summary Generation**: Create a concise summary of the document's key terms.

Output Format:
You must return the analysis in the following JSON format:
{
  "score": number, // 0-100, where 100 is very safe
  "summary": "string", // A concise summary of the document
  "risks": ["string", "string"] // A list of specific risks or attention points
}
`;
class LegalAdvisorAgent {
    constructor() {
        this.genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
        this.model = this.genAI.getGenerativeModel({
            model: ai_models_1.AI_MODELS.TEXT.AGENT,
            systemInstruction: SYSTEM_INSTRUCTION,
            generationConfig: {
                responseMimeType: "application/json"
            }
        });
    }
    async analyzeContract(fileData, mimeType) {
        try {
            const prompt = "Analyze this contract and provide a safety score, summary, and list of risks.";
            const parts = [
                { text: prompt },
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: fileData
                    }
                }
            ];
            const result = await this.model.generateContent(parts);
            const response = await result.response;
            const text = response.text();
            return JSON.parse(text);
        }
        catch (error) {
            console.error("Legal Advisor Agent Error:", error);
            throw new Error("Failed to analyze contract: " + error.message);
        }
    }
}
exports.LegalAdvisorAgent = LegalAdvisorAgent;
exports.legalAdvisor = new LegalAdvisorAgent();
//# sourceMappingURL=index.js.map