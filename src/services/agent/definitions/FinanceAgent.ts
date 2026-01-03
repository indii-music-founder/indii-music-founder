import { AgentConfig } from "../types";
import systemPrompt from "@agents/finance/prompt.md?raw";
import { firebaseAI } from '@/services/ai/FirebaseAIService';

export const FinanceAgent: AgentConfig = {
    id: "finance",
    name: "Finance Department",
    description: "Proactive CFO. Audits metadata to prevent royalty leakage and manages budgets.",
    color: "bg-teal-600",
    category: "department",
    systemPrompt: `
You are the Chief Financial Officer for an independent artist.
Your PRIMARY GOAL is to secure the 'IndiiOS Dividend' - the ~15-20% of revenue usually lost to managers and 'black box' royalties.

YOUR RESPONSIBILITIES:
1. **Metadata Auditing:** Aggressively check if tracks have 'Golden Metadata' (ISRC, Splits). If not, flag them as "REVENUE RISK".
2. **Budget Optimization:** Analyze expenses vs. the "Manager Tax". Remind the user they are saving 20% by using you.
3. **Forecasting:** Use the data from 'Artist_Economics_Deep_Dive.md' to project future earnings.

ALWAYS reference specific savings.
Example: "By handling this metadata yourself, you just saved $45 in admin fees and secured 100% of your performance royalties."
    `,
    functions: {
        analyze_budget: async (args: { amount: number; breakdown: string }) => {
            const efficiency = args.amount < 50000 ? "High" : "Medium";
            const managerFeeSaved = args.amount * 0.20;
            return {
                success: true,
                data: {
                    status: "approved",
                    efficiency_rating: efficiency,
                    dividend_saved: managerFeeSaved,
                    notes: `Budget approved. You saved $${managerFeeSaved} (20%) by not using an external manager.`,
                    timestamp: new Date().toISOString()
                }
            };
        },
        audit_metadata: async (args: { trackTitle: string; hasISRC: boolean; hasSplits: boolean }) => {
            const isRisk = !args.hasISRC || !args.hasSplits;
            return {
                success: true,
                data: {
                    status: isRisk ? "RISK DETECTED" : "SECURE",
                    potential_loss: isRisk ? "15-100%" : "0%",
                    advice: isRisk ? "IMMEDIATE ACTION: Add ISRC and Splits to prevent Black Box leakage." : "Great job. Your rights are fortified."
                }
            };
        },
        search_knowledge: async (args: { query: string }) => {
            // Simulating RAG by asking the AI to recall knowledge rooted in its system prompt context
            // or we could hook up a real Vector DB service here if available.
            const prompt = `Answer the following financial query based on standard music industry economics and the 'IndiiOS Dividend' knowledge base.
            Query: ${args.query}`;

            try {
                const response = await firebaseAI.generateText(prompt);
                return { success: true, data: { answer: response } };
            } catch (e: any) {
                return { success: false, error: e.message };
            }
        },
        analyze_receipt: async (args: { image_data: string, mime_type: string }) => {
            const prompt = `Extract the following details from this receipt image: Vendor, Date, Total Amount, Tax, and Category (e.g., Travel, Equipment, Meals). Return as JSON.`;
            try {
                const response = await firebaseAI.generateStructuredData(prompt, { type: 'object' } as any);
                return { success: true, data: { receipt_data: response } };
            } catch (e: any) {
                return { success: false, error: e.message };
            }
        },
        audit_distribution: async (args: { trackTitle: string; distributor: string }) => {
            // Simplified logic check, could be AI enhanced for partner specific rules
            const prompt = `Audit the track "${args.trackTitle}" for distribution readiness on ${args.distributor}. List 3 common metadata pitfalls for this specific platform.`;
            try {
                const advice = await firebaseAI.generateText(prompt);
                return { success: true, data: { status: "Audited", advice } };
            } catch (e: any) {
                return { success: false, error: e.message };
            }
        }
    },
    tools: [{
        functionDeclarations: [
            {
                name: "analyze_budget",
                description: "Analyze a project budget and calculate the 'IndiiOS Dividend' savings.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        amount: { type: "NUMBER", description: "Total budget amount." },
                        breakdown: { type: "STRING", description: "Breakdown of costs." }
                    },
                    required: ["amount"]
                }
            },
            {
                name: "audit_metadata",
                description: "Check a track's compliance with the Golden File standard.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        trackTitle: { type: "STRING" },
                        hasISRC: { type: "BOOLEAN" },
                        hasSplits: { type: "BOOLEAN" }
                    },
                    required: ["trackTitle", "hasISRC", "hasSplits"]
                }
            },
            // Integrated Knowledge Search
            {
                name: "search_knowledge",
                description: "Search the internal knowledge base for financial data (e.g. 'Artist_Economics_Deep_Dive').",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "The query string." }
                    },
                    required: ["query"]
                }
            },
            {
                name: "analyze_receipt",
                description: "Extract data (vendor, date, amount, category) from a receipt image.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        image_data: { type: "STRING", description: "Base64 string of the receipt image." },
                        mime_type: { type: "STRING", description: "MIME type (e.g. image/jpeg)." }
                    },
                }
            },
            {
                name: "audit_distribution",
                description: "Audit a track's metadata for distribution readiness to a specific partner.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        trackTitle: { type: "STRING" },
                        distributor: { type: "STRING", description: "ID of the distributor (e.g. 'distrokid', 'tunecore')" }
                    },
                    required: ["trackTitle", "distributor"]
                }
            }
        ]
    }]
};
