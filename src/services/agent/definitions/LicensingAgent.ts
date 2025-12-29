import { AgentConfig } from "../types";
import systemPrompt from '@agents/licensing/prompt.md?raw';
import { licensingService } from "../../licensing/LicensingService";
import { licenseScannerService } from "../../knowledge/LicenseScannerService";
import { AI } from "@/services/ai/AIService";
import { AI_MODELS, AI_CONFIG } from "@/core/config/ai-models";
import { LegalTools } from "../tools/LegalTools";
import { ToolFunctionArgs } from "../types";
import { LicenseRequest } from "../../licensing/types";

export const LicensingAgent: AgentConfig = {
    id: 'licensing',
    name: 'Licensing Department',
    description: 'Manages rights clearances and third-party licensing deals.',
    color: 'bg-indigo-600', // yellow-500 is used for icon, but bg-indigo for label
    category: 'department',
    systemPrompt,
    functions: {
        check_availability: async (args: { title: string, artist: string, usage: string, url?: string }) => {
            let analysis = null;
            let status: 'available' | 'restricted' | 'pending' = 'pending';
            let notes = "Beginning investigation into rights clearances.";

            if (args.url) {
                notes += " Analyzing provided source URL...";
                const scanResult = await licenseScannerService.scanUrl(args.url);
                analysis = scanResult;

                if (scanResult.licenseType === 'Royalty-Free' || scanResult.licenseType === 'Public Domain') {
                    status = 'available';
                    notes = `AI Analysis: ${scanResult.termsSummary}`;
                } else if (scanResult.licenseType === 'Rights-Managed') {
                    status = 'restricted';
                    notes = `AI Analysis: ${scanResult.termsSummary} requires negotiation.`;
                }
            }

            // Create a real request in Firestore
            const requestId = await licensingService.createRequest({
                title: args.title,
                artist: args.artist,
                usage: args.usage,
                status: 'checking',
                sourceUrl: args.url,
                aiAnalysis: analysis ? JSON.stringify(analysis) : undefined,
                notes: notes
            });

            return {
                success: true,
                data: {
                    requestId,
                    status: status,
                    title: args.title,
                    artist: args.artist,
                    quote: status === 'available' ? "FREE (TOS dependent)" : "TBD",
                    notes: notes + " Tracked as request: " + requestId
                }
            };
        },
        analyze_contract: async (args: { file_data: string, mime_type: string }) => {
            try {
                // Grounding and Identity Instructions (Rule 5.4 & 6)
                const prompt = `
                STRICT SYSTEM INSTRUCTIONS:
                - You are Gemini 3 Pro (High Thinking). You DO NOT fallback to simpler models.
                - Analyze the provided legal document ONLY. Do not use external knowledge or hallucinate terms not present in the text.
                - If the document is illegible or not a contract, state this clearly.

                TASK:
                Analyze this licensing agreement/contract. Provide a structured summary focusing on:
                1. Commercial Use Rights (Explicitly allowed/forbidden)
                2. Attribution Requirements (Credit obligations)
                3. Term/Duration (Length of license)
                4. Key Restrictions (Forbidden usages)

                Document Content (Base64/Text):
                ${args.file_data} 
                `; // Full context - no truncation (Rule 5.10)

                const response = await AI.generateContent({
                    model: AI_MODELS.TEXT.AGENT, // Upgraded to Gemini 3 Pro (Rule 2.1)
                    contents: { role: 'user', parts: [{ text: prompt }] },
                    // Enable High Reasoning (Rule 5.2)
                    ...AI_CONFIG.THINKING.HIGH
                });

                return {
                    success: true,
                    data: {
                        summary: response.text(),
                        next_steps: "AI Analysis complete. Legal counsel review mandatory for final approval."
                    }
                };
            } catch (error) {
                return { success: false, error: "Failed to analyze contract: " + (error as Error).message };
            }
        },
        draft_license: async (args: { type: string, parties: string[], terms: string }) => {
            try {
                const contract = await LegalTools.draft_contract({
                    type: args.type,
                    parties: args.parties,
                    terms: args.terms
                });

                return {
                    success: true,
                    data: {
                        contract,
                        message: "Initial draft generated. Review and finalize before signing."
                    }
                };
            } catch (error) {
                return { success: false, error: "Failed to draft license: " + (error as Error).message };
            }
        }
    },
    tools: [{
        functionDeclarations: [
            {
                name: "check_availability",
                description: "Check if a piece of content is available for licensing. Can use a URL for deep analysis.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        title: { type: "STRING", description: "Title of work." },
                        artist: { type: "STRING", description: "Artist name." },
                        usage: { type: "STRING", description: "Intended usage (e.g. film, social, ad)." },
                        url: { type: "STRING", description: "Optional URL to terms of service or sample pack page." }
                    },
                    required: ["title", "artist", "usage"]
                }
            },
            {
                name: "analyze_contract",
                description: "Analyze a licensing agreement using contract parsing tools.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        file_data: { type: "STRING", description: "Base64 file data." },
                        mime_type: { type: "STRING", description: "Mime type." }
                    },
                    required: ["file_data", "mime_type"]
                }
            },
            {
                name: "draft_license",
                description: "Draft a new licensing agreement or contract.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        type: { type: "STRING", description: "The type of agreement (e.g., Sync License, Master Use, NDA)." },
                        parties: { type: "ARRAY", items: { type: "STRING" }, description: "List of parties involved." },
                        terms: { type: "STRING", description: "Key terms and conditions to include." }
                    },
                    required: ["type", "parties", "terms"]
                }
            }
        ]
    }]
};
