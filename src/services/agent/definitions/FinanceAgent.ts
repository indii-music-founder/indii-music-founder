import { AgentConfig } from "../types";
import systemPrompt from "@agents/finance/prompt.md?raw";

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
            }
        ]
    }]
};
