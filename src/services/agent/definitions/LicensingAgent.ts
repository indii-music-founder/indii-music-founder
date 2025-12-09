import { AgentConfig } from "../types";
import systemPrompt from '@agents/licensing/prompt.md?raw';

export const LicensingAgent: AgentConfig = {
    id: 'licensing',
    name: 'Licensing Department',
    description: 'Manages rights clearances and third-party licensing deals.',
    color: 'bg-indigo-600',
    category: 'department',
    systemPrompt,
    functions: {
        check_availability: async (args: { title: string, artist: string, usage: string }) => {
            // Determine random availability
            const available = Math.random() > 0.3;
            return {
                status: available ? "available" : "restricted",
                title: args.title,
                artist: args.artist,
                quote: available ? "$2,500" : "N/A",
                notes: available
                    ? `Cleared for ${args.usage}.Contact label for final signature.`
                    : `Rights held by estate.Clearance unlikely for ${args.usage}.`
            };
        }
    },
    tools: [{
        functionDeclarations: [
            {
                name: "check_availability",
                description: "Check if a piece of content is available for licensing.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        title: { type: "STRING", description: "Title of work." },
                        artist: { type: "STRING", description: "Artist name." },
                        usage: { type: "STRING", description: "Intended usage (e.g. film, social, ad)." }
                    },
                    required: ["title", "artist"]
                }
            },
            {
                name: "analyze_contract",
                description: "Analyze a licensing agreement.",
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
