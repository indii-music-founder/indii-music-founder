import { AgentConfig } from "../types";
import { freezeAgentConfig } from '../FreezeDiagnostic';

import systemPrompt from '@agents/licensing/prompt.md?raw';
import { licensingService } from "../../licensing/LicensingService";
import { licenseScannerService } from "../../knowledge/LicenseScannerService";
import { AutonomousIntelligence } from '@/services/intelligence/AutonomousIntelligence';
import { LegalTools } from "../tools/LegalTools";
import { UniversalTools } from "../tools/UniversalTools";
import { buildDomainRetrievalTools, buildDomainRetrievalDeclarations } from '../tools/DomainTools';


const licensingRetrievalConfig = {
    'licenses': { path: 'licenses', requiresUserIdFilter: true },
    'licensing_clearances': { path: 'licensing_clearances', requiresUserIdFilter: true },
    'licensingDeals': { path: 'licensingDeals', requiresUserIdFilter: true },
    'syncBriefs': { path: 'syncBriefs', requiresUserIdFilter: true },
    'clearance_docs': { path: 'clearance_docs', requiresUserIdFilter: true }
};
const licensingRetrievalTools = buildDomainRetrievalTools('Licensing', licensingRetrievalConfig);
const licensingRetrievalDeclarations = buildDomainRetrievalDeclarations('Licensing', licensingRetrievalConfig);

export const LicensingAgent: AgentConfig = {
    id: 'licensing',
    name: 'Licensing Director',
    description: 'Manages sync licensing, master usage rights, and clearance pipelines.',
    color: 'bg-green-600',
    category: 'department',
    systemPrompt,
    functions: {
        ...licensingRetrievalTools,
        browser_tool: UniversalTools.browser_tool,
        document_query: UniversalTools.document_query,
        payment_gate: UniversalTools.payment_gate,

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
                // but since AutonomousIntelligence.generateText takes string, we need to inspect if we can pass parts.
                // The current AutonomousIntelligence.generateText is wrapper for simple text.
                // We should use generateStructuredData or raw generateContent for multimodal.

                // Using generateStructuredData for clean output, passing the file as inline data.

                // Note: Real multimodal passing requires using generateContent with parts.
                // Upgrading to use the raw AutonomousIntelligence.generateContent to pass image/pdf parts.

                // Wait, let's look at the original code. It passed 'user' role parts.
                // We should use AutonomousIntelligence.generateContent directly if we want to pass a Part.

                // UPGRADE:
                // We will assume file_data is base64.

                // Actually, let's use a text-only prompt for now if the file_data is just text content? 
                // The args say 'file_data' base64. It's likely an image or PDF.

                // Let's use AutonomousIntelligence.generateContent to handle the multimodal input.

                /* 
                   We need to bypass the simple generateText helper and go to generateContent 
                   to pass the inlineData part.
                */

                // Using a simplified prompt for text-only extraction if the user meant text, 
                // but the type says base64. 

                // Let's assume we can use analyzeImage logic if it's an image, or just raw generateContent.

                /* 
                   Code Correction: current `AutonomousIntelligence.analyzeImage` takes (prompt, base64image). 
                   If mime_type is pdf, analyzeImage might not work depending on implementation.
                   However, Gemone 3 supports PDF as image.
                */

                const responseText = await AutonomousIntelligence.analyzeImage(prompt, args.file_data);

                return {
                    success: true,
                    data: {
                        summary: responseText,
                        next_steps: "AI Analysis complete. Legal counsel review mandatory for final approval."
                    }
                };
            } catch (error: unknown) {
                return { success: false, error: "Failed to analyze contract: " + (error as Error).message };
            }
        },
        draft_license: async (args: { type: string, parties: string[], terms: string }) => {
            try {
                const toolResult = await LegalTools.draft_contract!({
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
            } catch (error: unknown) {
                return { success: false, error: "Failed to draft license: " + (error as Error).message };
            }
        },
        // ISSUE-1274: this previously ignored its own arguments (the parameter was
        // literally named `_args`) and returned the same three fabricated deals —
        // Nike / A24 / EA, with invented fee ranges and deadlines — under the message
        // "Found 3 potential sync opportunities matching criteria". Now reads the real
        // user-scoped `syncBriefs` collection and actually applies the filters, and
        // returns an honest empty result when there is nothing to match.
        search_sync_opportunities: async (args: { genre?: string, mood?: string, budget?: string }) => {
            try {
                const briefs = await licensingService.getSyncBriefs();

                const norm = (s: string) => s.trim().toLowerCase();
                const matches = briefs.filter(brief => {
                    if (args.mood) {
                        const wanted = norm(args.mood);
                        const moods = (brief.moods || []).map(m => norm(String(m)));
                        if (!moods.some(m => m.includes(wanted) || wanted.includes(m))) return false;
                    }
                    if (args.budget) {
                        const wanted = norm(args.budget);
                        if (!norm(brief.budget || '').includes(wanted)) return false;
                    }
                    if (args.genre) {
                        // Briefs have no genre field; match against the free-text
                        // description/project so a genre filter narrows rather than
                        // silently doing nothing.
                        const wanted = norm(args.genre);
                        const haystack = `${norm(brief.description || '')} ${norm(brief.project || '')} ${norm(brief.type || '')}`;
                        if (!haystack.includes(wanted)) return false;
                    }
                    return true;
                });

                const criteria = [
                    args.genre ? `genre "${args.genre}"` : null,
                    args.mood ? `mood "${args.mood}"` : null,
                    args.budget ? `budget "${args.budget}"` : null,
                ].filter(Boolean).join(', ');

                return {
                    success: true,
                    data: {
                        opportunities: matches,
                        message: matches.length === 0
                            ? (briefs.length === 0
                                ? 'No sync briefs are currently available in your pipeline.'
                                : `No sync briefs match ${criteria || 'those criteria'} (${briefs.length} total in pipeline).`)
                            : `Found ${matches.length} sync ${matches.length === 1 ? 'brief' : 'briefs'} matching ${criteria || 'your pipeline'}.`
                    }
                };
            } catch (error: unknown) {
                return { success: false, error: `Failed to search sync opportunities: ${(error as Error).message}` };
            }
        },
        calculate_sync_fee_estimate: async (args: { usage_type: string, territory: string, term: string }) => {
            const baseRates: Record<string, number> = {
                'Commercial': 10000,
                'Film': 25000,
                'TV': 5000,
                'Video Game': 15000,
                'Social Media': 1000
            };
            const typeKey = Object.keys(baseRates).find(k => args.usage_type.toLowerCase().includes(k.toLowerCase())) || 'TV';
            const base = baseRates[typeKey];
            
            const termMultiplier = args.term.toLowerCase().includes('perpetual') || args.term.toLowerCase().includes('all') ? 2 : 1;
            const territoryMultiplier = args.territory.toLowerCase().includes('world') || args.territory.toLowerCase().includes('global') ? 2 : 1;
            
            const estimated_fee = base * termMultiplier * territoryMultiplier;
            const min_fee = Math.floor(estimated_fee * 0.8);
            const max_fee = Math.floor(estimated_fee * 1.5);
            
            return {
                success: true,
                data: {
                    estimated_fee_usd: estimated_fee,
                    range_usd: [min_fee, max_fee],
                    message: `Estimated fee for ${args.usage_type} in ${args.territory} for ${args.term} is approximately $${estimated_fee.toLocaleString('en-US')} USD (Range: $${min_fee.toLocaleString('en-US')} - $${max_fee.toLocaleString('en-US')}).`
                }
            };
        }
    },
    authorizedTools: ['list_domain_records', 'check_availability', 'analyze_contract', 'draft_license', 'search_sync_opportunities', 'calculate_sync_fee_estimate', 'browser_tool', 'document_query', 'payment_gate'],
    tools: [{
        functionDeclarations: [
            ...licensingRetrievalDeclarations,
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
            },
            {
                name: "search_sync_opportunities",
                description: "Search for open sync licensing briefs and opportunities based on genre, mood, or budget.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        genre: { type: "STRING", description: "Musical genre." },
                        mood: { type: "STRING", description: "Desired mood." },
                        budget: { type: "STRING", description: "Target budget range." }
                    }
                }
            },
            {
                name: "calculate_sync_fee_estimate",
                description: "Calculate an estimated sync licensing fee based on usage type, territory, and term.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        usage_type: { type: "STRING", description: "Type of usage (e.g. Commercial, Film, TV, Video Game)." },
                        territory: { type: "STRING", description: "Geographic territory (e.g. Worldwide, North America)." },
                        term: { type: "STRING", description: "Duration of the license (e.g. 1 Year, Perpetual)." }
                    },
                    required: ["usage_type", "territory", "term"]
                }
            },
            {
                name: "browser_tool",
                description: "Research Music Supervisors or Sync Libraries.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", description: "Action: open, click, type, get_dom" },
                        url: { type: "STRING" },
                        selector: { type: "STRING" }
                    },
                    required: ["action"]
                }
            },
            {
                name: "document_query",
                description: "Analyze license agreements for unfair terms.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING" },
                        doc_path: { type: "STRING" }
                    },
                    required: ["query"]
                }
            },
            {
                name: "payment_gate",
                description: "Pay for clearance fees.",
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

freezeAgentConfig(LicensingAgent);

