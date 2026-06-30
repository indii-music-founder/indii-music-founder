import { AgentConfig } from "@/services/agent/types";
import systemPrompt from './prompt.md?raw';

export const RightsAgent: AgentConfig = {
    id: "rights",
    name: "Rights & Registration Orchestrator",
    description: "Manages copyright registration workflows, filing packets, portal submissions, and rights orchestration across PROs/CMOs.",
    color: "bg-blue-700",
    category: "department",
    systemPrompt,
    authorizedTools: [
        'compile_release_harness',
        'generate_release_identifiers',
        'analyze_contract',
        'generate_split_sheet',
        'draft_contract',
    ],
    tools: [{
        functionDeclarations: [
            {
                name: "compile_release_harness",
                description: "Compile the publishing readiness & rights readiness harness for a release or track.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        trackId: { type: "STRING", description: "Track/song ID" },
                        domain: { type: "STRING", description: "Harness domain (publishing_rights, etc.)" }
                    },
                    required: ["trackId"]
                }
            },
            {
                name: "generate_release_identifiers",
                description: "Generate ISRC, UPC, and ISWC work drafts for registration without store delivery.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        trackId: { type: "STRING", description: "Track ID" },
                        releaseTitle: { type: "STRING", description: "Release title" }
                    },
                    required: ["trackId"]
                }
            },
            {
                name: "analyze_contract",
                description: "Analyze a legal contract for rights and registration implications.",
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
                name: "generate_split_sheet",
                description: "Generate a split sheet for writers, producers, and rights holders.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        trackId: { type: "STRING", description: "Track ID" },
                        parties: { type: "ARRAY", items: { type: "STRING" }, description: "Names of parties" },
                        splits: { type: "ARRAY", items: { type: "OBJECT" }, description: "Split percentages" }
                    },
                    required: ["trackId", "parties"]
                }
            },
            {
                name: "draft_contract",
                description: "Draft a registration agreement or rights document.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        type: { type: "STRING", description: "Type of contract (e.g., Split Sheet Agreement)" },
                        parties: { type: "ARRAY", items: { type: "STRING" }, description: "List of parties." },
                        terms: { type: "STRING", description: "Key terms and conditions." }
                    },
                    required: ["type", "parties"]
                }
            }
        ]
    }],
    get functions() {
        return {} as Record<string, import('@/services/agent/types').AnyToolFunction>;
    }
};
