import { AgentConfig } from "../types";
import systemPrompt from "@agents/legal/prompt.md?raw";
import { LegalTools } from "../tools/LegalTools";

export const LegalAgent: AgentConfig = {
    id: "legal",
    name: "Legal Department",
    description: "Drafts contracts, reviews compliance, and manages intellectual property.",
    color: "bg-red-700",
    category: "department",
    systemPrompt,
    functions: {
        analyze_contract: LegalTools.analyze_contract,
        generate_nda: LegalTools.generate_nda
    },
    tools: [{
        functionDeclarations: [
            {
                name: "analyze_contract",
                description: "Analyze a legal contract for risks and provide a summary.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        fileData: { type: "STRING", description: "Base64 encoded file data." },
                        mimeType: { type: "STRING", description: "MIME type of the file (e.g., application/pdf)." }
                    },
                    required: ["fileData"]
                }
            },
            {
                name: "generate_nda",
                description: "Generate a generic NDA for specified parties.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        parties: { type: "ARRAY", items: { type: "STRING" }, description: "List of parties involved." },
                        purpose: { type: "STRING", description: "The purpose of the NDA." }
                    },
                    required: ["parties"]
                }
            }
        ]
    }]
};
