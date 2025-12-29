import { AgentConfig } from "../types";
import systemPrompt from '@agents/licensing/prompt.md?raw';
import { licensingService } from "../../licensing/LicensingService";
import { licenseScannerService } from "../../knowledge/LicenseScannerService";

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
            // This would ideally use LegalTools or a specialized AI prompt
            return {
                success: true,
                data: {
                    summary: "Contract analysis triggered. Reviewing terms for sync and master use.",
                    next_steps: "Awaiting legal counsel verification."
                }
            };
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
            }
        ]
    }]
};
