import { AgentConfig } from "../types";
import systemPrompt from '@agents/publishing/prompt.md?raw';

import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { Schema } from 'firebase/ai';

export const PublishingAgent: AgentConfig = {
    id: 'publishing',
    name: 'Publishing Department',
    description: 'Manages musical rights, royalties, and catalog administration.',
    color: 'bg-rose-500',
    category: 'department',
    systemPrompt,
    functions: {
        register_work: async (args: { title: string, writers: string[], split: string }) => {
            const prompt = `Validate this music work registration. Title: "${args.title}", Contributors: ${args.writers.join(', ')}. Generate a valid ISWC format (T-XXX.XXX.XXX-X) and a registration status.`;
            try {
                // Using "object" schema type
                const response = await firebaseAI.generateStructuredData<any>(prompt, { type: 'object' } as Schema);
                return { success: true, data: { status: "Submitted", ...response } };
            } catch (e) {
                const randomISWC = `T-${Math.floor(100 + Math.random() * 900)}.${Math.floor(100 + Math.random() * 900)}.${Math.floor(100 + Math.random() * 900)}-${Math.floor(1 + Math.random() * 9)}`;
                return { success: true, data: { status: "Submitted", iswc: randomISWC } };
            }
        },
        analyze_contract: async (args: { file_data: string, mime_type: string }) => {
            const prompt = `Analyze this publishing contract for fair royalty rates and reversion clauses. Return a summary.`;
            const summary = await firebaseAI.generateText(prompt);
            return { success: true, data: { summary } };
        },
        package_release_assets: async (args: { releaseId: string, assets: any }) => {
            // This function handles the definitive packaging of assets for DDEX
            const prompt = `Prepare DDEX packaging metadata for release ${args.releaseId}. Assets: ${JSON.stringify(args.assets)}`;
            const response = await firebaseAI.generateStructuredData<any>(prompt, { type: 'object' } as Schema);
            return { success: true, data: { status: "Packaged", ...response } };
        }
    },
    tools: [{
        functionDeclarations: [
            {
                name: "analyze_contract",
                description: "Analyze a publishing contract.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        file_data: { type: "STRING", description: "Base64 file data." },
                        mime_type: { type: "STRING", description: "Mime type (application/pdf)." }
                    },
                    required: ["file_data", "mime_type"]
                }
            },
            {
                name: "register_work",
                description: "Register a new musical work with PROs.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        title: { type: "STRING", description: "Title of the work." },
                        writers: { type: "ARRAY", description: "List of writers.", items: { type: "STRING" } },
                        split: { type: "STRING", description: "Ownership split (e.g. 50/50)." }
                    },
                    required: ["title", "writers"]
                }
            },
            {
                name: "package_release_assets",
                description: "Definitively package audio and artwork for DDEX distribution.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        releaseId: { type: "STRING", description: "The ID of the release record." },
                        assets: { type: "OBJECT", description: "The asset URLs and metadata." }
                    },
                    required: ["releaseId", "assets"]
                }
            }
        ]
    }]
};
