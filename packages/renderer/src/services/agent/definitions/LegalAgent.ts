import { AgentConfig } from "../types";
import systemPrompt from '@agents/legal/prompt.md?raw';

export const LegalAgent: AgentConfig = {
    id: "legal",
    name: "Legal Director",
    description: "Automated copyright clearance, rights management, and contract analysis.",
    color: "bg-yellow-500",
    category: "department",
    systemPrompt: systemPrompt,
    functions: {
        analyze_rights: async (args: { isCover: boolean, hasSamples: boolean, aiGenerated: boolean }) => {
            const risks = [];
            let advice = "";

            if (args.isCover) {
                risks.push("Mechanical License Required (Publishing)");
                advice += "Since this is a cover, you own the Master, but you must pay mechanical royalties to the original songwriter. ";
            }
            if (args.hasSamples) {
                risks.push("Master Use License Required");
                risks.push("Sync/Publishing License Required");
                advice += "Samples require clearance from both the record label (Master) and the publisher (Composition). ";
            }
            if (args.aiGenerated) {
                risks.push("Copyright Eligibility Uncertainty");
                risks.push("Right of Publicity (if mimicking real artist)");
                advice += "AI generated works may not be copyrightable in some jurisdictions. Ensure you didn't just prompt 'Style of Taylor Swift'. ";
            }

            if (risks.length === 0) {
                return {
                    success: true,
                    data: {
                        status: "CLEAN",
                        message: "No obvious copyright hurdles detected. You likely own 100% of Master and Publishing."
                    }
                };
            }

            return {
                success: true,
                data: {
                    status: "ACTION REQUIRED",
                    risks: risks,
                    advice: advice.trim()
                }
            };
        }
    },
    tools: [{
        functionDeclarations: [
            {
                name: "analyze_rights",
                description: "Analyze the copyright status of a track based on its composition.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        isCover: { type: "BOOLEAN" },
                        hasSamples: { type: "BOOLEAN" },
                        aiGenerated: { type: "BOOLEAN" }
                    },
                    required: ["isCover", "hasSamples", "aiGenerated"]
                }
            },
            {
                name: "browser_tool",
                description: "Research copyright databases or legal precedents.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING" },
                        url: { type: "STRING" },
                        selector: { type: "STRING" }
                    },
                    required: ["action"]
                }
            },
            {
                name: "document_query",
                description: "Analyze a legal document (PDF/Text) for clauses.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "What to look for (e.g. 'Term length')" },
                        doc_path: { type: "STRING", description: "Path to the document" }
                    },
                    required: ["query"]
                }
            },
            {
                name: "draft_split_sheet",
                description: "Generates a standard split sheet for collaborators and initiates digital signatures via Docusign API mock.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        trackName: { type: "STRING" },
                        collaborators: {
                            type: "ARRAY",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    name: { type: "STRING" },
                                    email: { type: "STRING" },
                                    role: { type: "STRING", enum: ["Producer", "Songwriter", "Feature", "Publisher"] },
                                    splitPercentage: { type: "NUMBER" }
                                }
                            }
                        }
                    },
                    required: ["trackName", "collaborators"]
                }
            }
        ]
    }]
};

// Freeze the schema to prevent cross-test contamination
