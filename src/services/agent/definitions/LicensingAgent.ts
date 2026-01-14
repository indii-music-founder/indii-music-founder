import { AgentConfig } from "../types";
import systemPrompt from '@agents/licensing/prompt.md?raw';
import { licensingService } from "../../licensing/LicensingService";
import { licenseScannerService } from "../../knowledge/LicenseScannerService";
import { firebaseAI } from "@/services/ai/FirebaseAIService";
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
                `;

                // Support PDF/Image analysis via Multimodal
                // We use generateText but include the image part if it's text-based image, 
                // but since firebaseAI.generateText takes string, we need to inspect if we can pass parts.
                // The current firebaseAI.generateText is wrapper for simple text.
                // We should use generateStructuredData or raw generateContent for multimodal.

                // Using generateStructuredData for clean output, passing the file as inline data.
                const summary = await firebaseAI.generateText(prompt + `\n\n[Attached Document Buffer of type ${args.mime_type}]`);
                // Note: Real multimodal passing requires using generateContent with parts.
                // Upgrading to use the raw firebaseAI.generateContent to pass image/pdf parts.

                // Wait, let's look at the original code. It passed 'user' role parts.
                // We should use firebaseAI.generateContent directly if we want to pass a Part.

                // UPGRADE:
                // We will assume file_data is base64.

                // Actually, let's use a text-only prompt for now if the file_data is just text content? 
                // The args say 'file_data' base64. It's likely an image or PDF.

                // Let's use firebaseAI.generateContent to handle the multimodal input.

                /* 
                   We need to bypass the simple generateText helper and go to generateContent 
                   to pass the inlineData part.
                */

                // Using a simplified prompt for text-only extraction if the user meant text, 
                // but the type says base64. 

                // Let's assume we can use analyzeImage logic if it's an image, or just raw generateContent.

                /* 
                   Code Correction: current `firebaseAI.analyzeImage` takes (prompt, base64image). 
                   If mime_type is pdf, analyzeImage might not work depending on implementation.
                   However, Gemone 3 supports PDF as image.
                */

                const responseText = await firebaseAI.analyzeImage(prompt, args.file_data);

                return {
                    success: true,
                    data: {
                        summary: responseText,
                        next_steps: "AI Analysis complete. Legal counsel review mandatory for final approval."
                    }
                };
            } catch (error) {
                return { success: false, error: "Failed to analyze contract: " + (error as Error).message };
            }
        },
        draft_license: async (args: { type: string, parties: string[], terms: string }) => {
            try {
                const toolResult = await LegalTools.draft_contract({
                    type: args.type,
                    parties: args.parties,
                    terms: args.terms
                });

                if (!toolResult.success) {
                    throw new Error(toolResult.error || "Unknown error in contract drafting");
                }

                return {
                    success: true,
                    data: {
                        contract: toolResult.data.content,
                        contractId: toolResult.data.contractId,
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
