import { AgentConfig } from "../types";
import systemPrompt from "@agents/finance/prompt.md?raw";
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { Schema } from 'firebase/ai';

export const FinanceAgent: AgentConfig = {
    id: "finance",
    name: "Finance Department",
    description: "Proactive CFO. Audits metadata to prevent royalty leakage and manages budgets.",
    color: "bg-emerald-500",
    category: "department",
    systemPrompt: `
You are the **Music Industry Finance Specialist**, a specialist agent within the indii system.

## indii Architecture (Hub-and-Spoke)
As a specialist (spoke), you operate under strict architectural rules:
1. **Delegation:** You can ONLY delegate tasks or consult experts by going back to the Hub ('generalist' / Agent Zero).
2. **Horizontal Communication:** You CANNOT communicate directly with other specialist agents (Legal, Marketing, Video, etc.).
3. **Coordination:** If you need help from another domain (e.g., Marketing for campaign spend), ask Agent Zero to coordinate.

## Role
Your role is to oversee the financial health of the studio, the artist's career, and specific music projects. You are an expert in music royalty streams, tour budgeting, and recoupment analysis.

## Responsibilities:

1. **Recoupment Analysis:** Analyze advances (from labels or distributors) vs. expenses to determine the "breakeven" point for releases.
2. **Tour Budgeting:** Forecast revenue from ticket sales and merch vs. costs (travel, crew, venue fees, commission).
3. **Royalty Forecasting:** Estimate earnings from streaming (mechanical/performance), sync licensing, and publishing.
4. **Project ROI:** Evaluate the financial viability of music videos, marketing spends, and physical manufacturing (vinyl/merch).
5. **Expense Tracking:** Monitor day-to-day studio and operational costs, categorizing them for tax and audit readiness.

## Perspective:
Be conservative, analytical, and numbers-driven. You are the financial conscience of the artist, ensuring long-term sustainability in a volatile industry.

Think in terms of "Gross vs. Net," "Artist Share," and "Burn Rate."
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
            /**
             * Answer financial queries based on industry economics.
             * Simulating RAG by asking the AI to recall knowledge rooted in its system prompt context.
             */
            const prompt = `Answer the following financial query based on standard music industry economics and the 'indiiOS Dividend' knowledge base.
            Query: ${args.query}`;

            try {
                const response = await firebaseAI.generateText(prompt);
                return { success: true, data: { answer: response } };
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                return { success: false, error: message };
            }
        },
        analyze_receipt: async (args: { image_data: string, mime_type: string }) => {
            /**
             * Extract details from a receipt image using structured data generation.
             */
            const prompt = `Extract the following details from this receipt image: Vendor, Date, Total Amount, Tax, and Category (e.g., Travel, Equipment, Meals). Return as JSON.`;
            try {
                const response = await firebaseAI.generateStructuredData(prompt, { type: 'object', nullable: false } as Schema);
                return { success: true, data: { receipt_data: response } };
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                return { success: false, error: message };
            }
        },
        audit_distribution: async (args: { trackTitle: string; distributor: string }) => {
            /**
             * Audit track metadata for distribution readiness to a specific partner.
             */
            const prompt = `Audit the track "${args.trackTitle}" for distribution readiness on ${args.distributor}. List 3 common metadata pitfalls for this specific platform.`;
            try {
                const advice = await firebaseAI.generateText(prompt);
                return { success: true, data: { status: "Audited", advice } };
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                return { success: false, error: message };
            }
        }
    },
    tools: [{
        functionDeclarations: [
            {
                name: "analyze_budget",
                description: "Analyze a project budget and calculate the 'indiiOS Dividend' savings.",
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
            },
            {
                name: "credential_vault",
                description: "Securely retrieve passwords for royalty portals or banks.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", description: "retrieve" },
                        service: { type: "STRING", description: "Service name (e.g. SoundExchange)" }
                    },
                    required: ["action", "service"]
                }
            },
            {
                name: "payment_gate",
                description: "Authorize payments for invoices or fees.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        amount: { type: "NUMBER" },
                        vendor: { type: "STRING" },
                        reason: { type: "STRING" }
                    },
                    required: ["amount", "vendor", "reason"]
                }
            },
            {
                name: "browser_tool",
                description: "Check exchange rates or tax information.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: { type: "STRING", description: "Action: open, click, type, get_dom" },
                        url: { type: "STRING" },
                        selector: { type: "STRING" }
                    },
                    required: ["action"]
                }
            }
        ]
    }]
};

import { freezeAgentConfig } from '../FreezeDiagnostic';

// Freeze the schema to prevent cross-test contamination
freezeAgentConfig(FinanceAgent);
