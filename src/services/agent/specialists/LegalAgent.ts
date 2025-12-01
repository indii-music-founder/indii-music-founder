import { BaseAgent } from './BaseAgent';

export class LegalAgent extends BaseAgent {
    id = 'legal';
    name = 'Legal Assistant';
    description = 'Handles contracts, rights management, and compliance checks.';
    systemPrompt = `You are the Legal Assistant for a creative studio.
    Your role is to review contracts, advise on intellectual property rights, and ensure compliance.
    Be precise, formal, and risk-averse.
    Always clarify that you are an AI and this is not professional legal advice.`;

    tools = [
        {
            functionDeclarations: [
                {
                    name: "analyze_contract_risk",
                    description: "Analyzes a contract text for potential risks and red flags.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            contract_text: {
                                type: "STRING",
                                description: "The full text of the contract clause or document."
                            },
                            risk_tolerance: {
                                type: "STRING",
                                enum: ["low", "medium", "high"],
                                description: "The acceptable level of risk."
                            }
                        },
                        required: ["contract_text"]
                    }
                }
            ]
        }
    ];

    constructor() {
        super();
        this.functions = {
            analyze_contract_risk: async (args: { contract_text: string, risk_tolerance: string }) => {
                // Production Implementation: Recursive AI Call
                // We use a dedicated AI call to analyze the specific text segment.

                const analysisPrompt = `
                ACT AS: Senior Legal Analyst.
                TASK: Analyze the following contract clause for risks.
                CONTEXT: Risk Tolerance is set to '${args.risk_tolerance}'.
                
                CLAUSE:
                "${args.contract_text}"
                
                OUTPUT JSON:
                {
                    "status": "analyzed",
                    "risk_level": "low" | "medium" | "high",
                    "flags": ["list of specific risk flags"],
                    "recommendation": "brief actionable advice"
                }
                `;

                try {
                    const { AI } = await import('@/services/ai/AIService');
                    const { AI_MODELS, AI_CONFIG } = await import('@/core/config/ai-models');

                    const response = await AI.generateContent({
                        model: AI_MODELS.TEXT.FAST, // Use fast model for sub-tasks
                        contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }],
                        config: {
                            responseMimeType: 'application/json',
                            ...AI_CONFIG.THINKING.LOW
                        }
                    });

                    const result = AI.parseJSON(response.text());
                    return result;

                } catch (error: any) {
                    console.error("Legal Analysis Failed:", error);
                    return {
                        status: "error",
                        risk_level: "unknown",
                        flags: [`Analysis failed: ${error.message}`],
                        recommendation: "Manual review required due to system error."
                    };
                }
            }
        };
    }
}

