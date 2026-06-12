import { AgentConfig } from "../types";
import { logger } from '@/utils/logger';
import systemPrompt from '@agents/publishing/prompt.md?raw';

import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { Schema } from 'firebase/ai';
import { PublishingTools } from '../tools/PublishingTools';
import { UniversalTools } from '../tools/UniversalTools';

export const PublishingAgent: AgentConfig = {
    id: 'publishing',
    name: 'Publishing Director',
    description: 'Manages musical rights, royalties, and catalog administration.',
    color: 'bg-indigo-600',
    category: 'department',
    systemPrompt: systemPrompt,
    functions: {
        register_work: async (args: { title: string, writers: string[], split: string }) => {
            const prompt = `Validate this music work registration draft. Title: "${args.title}", Contributors: ${args.writers.join(', ')}. Return missing fields, split warnings, and filing readiness. Do not generate or claim an official ISWC.`;
            try {
                const response = await AutonomousIntelligence.generateStructuredData<Record<string, unknown>>(prompt, { type: 'object' } as Schema, { maxOutputTokens: 8192, temperature: 1.0 });
                return {
                    success: true,
                    data: {
                        status: "DraftReady",
                        officialSubmission: false,
                        iswc: null,
                        ...response
                    }
                };
            } catch (error) {
                const appException = AutonomousIntelligence.handleError(error);
                logger.warn('[PublishingAgent] Registration draft validation failed', appException);
                return {
                    success: false,
                    error: 'Publishing registration could not be validated. No PRO submission or ISWC was generated.',
                    data: {
                        status: "ValidationFailed",
                        officialSubmission: false,
                        iswc: null
                    }
                };
            }
        },
        analyze_contract: async (_args: { file_data: string, mime_type: string }) => {
            const prompt = `Analyze this publishing contract for fair royalty rates and reversion clauses. Return a summary.`;
            const summary = await AutonomousIntelligence.generateText(prompt, { maxOutputTokens: 8192, temperature: 1.0 });
            return { success: true, data: { summary } };
        },
        package_release_assets: async (args: { releaseId: string, assets: Record<string, unknown> }) => {
            const prompt = `Prepare release delivery metadata readiness for release ${args.releaseId}. Assets: ${JSON.stringify(args.assets)}. Return missing delivery fields and review blockers. Do not claim external DSP delivery.`;
            const response = await AutonomousIntelligence.generateStructuredData<Record<string, unknown>>(prompt, { type: 'object' } as Schema, { maxOutputTokens: 8192, temperature: 1.0 });
            return { success: true, data: { status: "ReadyForReview", externalDelivery: false, ...response } };
        },
        check_pro_catalog: PublishingTools.check_pro_catalog,
        pro_scraper: UniversalTools.pro_scraper,
        payment_gate: UniversalTools.payment_gate,
    },
    authorizedTools: ['analyze_contract', 'register_work', 'check_pro_catalog', 'package_release_assets', 'pro_scraper', 'payment_gate'],
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
                name: "check_pro_catalog",
                description: "Queries PROs (ASCAP/BMI) for existing catalog matches to prevent duplicate registration.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        trackTitle: { type: "STRING", description: "Title of the musical work." },
                        writerName: { type: "STRING", description: "Name of the writer to check." },
                        ipiNumber: { type: "STRING", description: "The IPI (Interested Party Information) number of the writer (optional)." }
                    },
                    required: ["trackTitle", "writerName"]
                }
            },
            {
                name: "package_release_assets",
                description: "Prepare audio, artwork, and metadata for distribution delivery review.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        releaseId: { type: "STRING", description: "The ID of the release record." },
                        assets: { type: "OBJECT", description: "The asset URLs and metadata." }
                    },
                    required: ["releaseId", "assets"]
                }
            },
            {
                name: "pro_scraper",
                description: "Audit public repertories (ASCAP/BMI) for catalog accuracy.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Song or Writer name." },
                        society: { type: "STRING", description: "ASCAP or BMI." }
                    },
                    required: ["query", "society"]
                }
            },
            {
                name: "payment_gate",
                description: "Authorize fees for song registration.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        amount: { type: "NUMBER" },
                        vendor: { type: "STRING" },
                        reason: { type: "STRING" }
                    },
                    required: ["amount", "vendor", "reason"]
                }
            }
        ]
    }]
};
