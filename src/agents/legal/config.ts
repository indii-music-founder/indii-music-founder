import { AgentConfig } from "@/services/agent/types";
import systemPrompt from './prompt.md?raw';
import { LegalTools } from "@/services/agent/tools/LegalTools";
import { AnalysisTools } from "@/services/agent/tools/AnalysisTools";

export const LegalAgent: AgentConfig = {
    id: "legal",
    name: "Legal Department",
    description: "Drafts contracts, reviews compliance, and manages intellectual property.",
    color: "bg-red-700",
    category: "department",
    systemPrompt,
    tools: [{
        functionDeclarations: [
            {
                name: "analyze_contract",
                description: "Analyze a legal contract for risks and provide a summary.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        file_data: { type: "STRING", description: "Base64 encoded file data." },
                        mime_type: { type: "STRING", description: "MIME type of the file (e.g., application/pdf)." }
                    },
                    required: ["file_data"]
                }
            },
            {
                name: "draft_contract",
                description: "Draft a new legal contract or agreement.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        type: { type: "STRING", description: "Type of contract (e.g. NDA, Deal Memo)." },
                        parties: { type: "ARRAY", items: { type: "STRING" }, description: "List of parties involved." },
                        terms: { type: "STRING", description: "Key terms and conditions." }
                    },
                    required: ["type", "parties", "terms"]
                }
            },
            {
                name: "generate_nda",
                description: "Rapidly generate a standard NDA.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        parties: { type: "ARRAY", items: { type: "STRING" }, description: "List of parties." },
                        purpose: { type: "STRING", description: "Purpose of disclosure." }
                    },
                    required: ["parties"]
                }
            }
        ]
    }],
    functions: {
        analyze_contract: AnalysisTools.analyze_contract,
        draft_contract: LegalTools.draft_contract,
        generate_nda: LegalTools.generate_nda
    }
};
