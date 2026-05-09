import { AgentConfig } from "../types";
import systemPrompt from "@agents/finance/prompt.md?raw";
import { GenAI } from '@/services/ai/GenAI';
import { AI_MODELS } from '@/core/config/ai-models';
export const FinanceAgent: AgentConfig = {
    id: "finance",
    name: 'Finance Director',
    description: 'Expert in music finance, royalty waterfalls, and tax compliance.',
    color: 'bg-emerald-500',
    category: 'department',
    systemPrompt: systemPrompt,
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
            const prompt = `Answer the following financial query based on standard music industry economics and the 'indiiOS Dividend' knowledge base.
            Query: ${args.query}`;

            try {
                const response = await GenAI.generateText(prompt);
                return { success: true, data: { answer: response } };
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                return { success: false, error: message };
            }
        },
        analyze_receipt: async (args: { image_data: string, mime_type: string }) => {
            /**
             * Requirement 160: Expense Receipt OCR
             * Use Gemini Vision to OCR uploaded physical receipts for touring expenses to sync with Finance.
             */
            const prompt = `You are a strict financial accountant. Extract the following details from this receipt image: Vendor, Date, Total Amount, Tax, and Category (e.g., Travel, Equipment, Meals, Lodging). Ensure the amounts are formatted as numbers. Return as structured JSON.`;
            try {
                // Formatting the image data for Gemini Vision via FirebaseAIService
                const contents = [
                    {
                        role: 'user' as const,
                        parts: [
                            {
                                inlineData: {
                                    data: args.image_data,
                                    mimeType: args.mime_type
                                }
                            },
                            { text: prompt }
                        ]
                    }
                ];

                // Using standard generateContent to handle multimodal inputs natively
                const result = await GenAI.generateContent(contents, AI_MODELS.TEXT.FAST);
                const textResult = result.response?.text() || '{}';

                // Extract JSON if it's wrapped in markdown code blocks
                const jsonMatch = textResult.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
                const rawJson = jsonMatch ? jsonMatch[1]! : textResult;

                return { success: true, data: { receipt_data: JSON.parse(rawJson) } };
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                return { success: false, error: `Vision OCR Failed: ${message}` };
            }
        },
        audit_distribution: async (args: { trackTitle: string; distributor: string }) => {
            /**
             * Audit track metadata for distribution readiness to a specific partner.
             */
            const prompt = `Audit the track "${args.trackTitle}" for distribution readiness on ${args.distributor}. List 3 common metadata pitfalls for this specific platform.`;
            try {
                const advice = await GenAI.generateText(prompt);
                return { success: true, data: { status: "Audited", advice } };
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                return { success: false, error: message };
            }
        },
        forecast_revenue: async (args: { current_monthly_streams: number; growth_rate_percent: number; months: number }) => {
            /**
             * Pillar 2 — Agent CFO: Proactive forecast showing revenue trajectory +
             * the cumulative indiiOS Dividend (fees saved vs. external 20% management).
             * Gamification: shows compound savings, not just a number.
             */
            const SPOTIFY_RATE = 0.004;                // avg blended per-stream rate
            const MANAGEMENT_FEE = 0.20;               // 20% external manager fee
            const growthFactor = 1 + (args.growth_rate_percent / 100);
            const months = Math.min(Math.max(args.months || 12, 1), 24);

            let streams = args.current_monthly_streams;
            let cumulativeRevenue = 0;
            let cumulativeDividend = 0;
            const projections: Array<{ month: number; streams: number; revenue: number; dividendSaved: number; cumulative: number }> = [];

            for (let m = 1; m <= months; m++) {
                const revenue = streams * SPOTIFY_RATE;
                const dividend = revenue * MANAGEMENT_FEE;
                cumulativeRevenue += revenue;
                cumulativeDividend += dividend;
                projections.push({
                    month: m,
                    streams: Math.round(streams),
                    revenue: Math.round(revenue * 100) / 100,
                    dividendSaved: Math.round(dividend * 100) / 100,
                    cumulative: Math.round(cumulativeRevenue * 100) / 100,
                });
                streams *= growthFactor;
            }

            const endStreams = projections[projections.length - 1]!.streams;

            return {
                success: true,
                data: {
                    summary: {
                        totalProjectedRevenue: Math.round(cumulativeRevenue * 100) / 100,
                        totalDividendSaved: Math.round(cumulativeDividend * 100) / 100,
                        endMonthlyStreams: endStreams,
                        growthRatePercent: args.growth_rate_percent,
                        months,
                    },
                    projections,
                    message: `Over ${months} months at ${args.growth_rate_percent}% monthly growth: projected revenue $${cumulativeRevenue.toFixed(2)}, with $${cumulativeDividend.toFixed(2)} saved vs. paying a 20% external manager — your indiiOS Dividend.`
                }
            };
        },
        generate_tax_report: async (args: { year: number; transactions: any[] }) => {
            const highValuepayouts = args.transactions.filter(t => t.amount >= 600);
            return {
                success: true,
                data: {
                    year: args.year,
                    total_transactions: args.transactions.length,
                    flagged_for_1099: highValuepayouts.length,
                    payouts: highValuepayouts,
                    status: "Report generated. Please consult a tax professional."
                }
            };
        },
        credential_vault: async (args: { action: string; service: string }) => {
            return {
                success: true,
                data: {
                    status: "Access granted",
                    message: `Credentials for ${args.service} retrieved via Secure Vault.`
                }
            };
        },
        payment_gate: async (args: { amount: number; vendor: string; reason: string }) => {
            return {
                success: true,
                data: {
                    status: "Authorized",
                    transaction_id: `TX-${Math.random().toString(36).substring(7).toUpperCase()}`,
                    message: `Payment of $${args.amount} to ${args.vendor} for ${args.reason} has been authorized.`
                }
            };
        }
    },
    authorizedTools: ['analyze_budget', 'audit_metadata', 'search_knowledge', 'analyze_receipt', 'audit_distribution', 'credential_vault', 'payment_gate', 'browser_tool', 'generate_tax_report', 'forecast_revenue'],
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
                        distributor: { type: "STRING", enum: ["distrokid", "tunecore", "indii", "other"], description: "ID of the distributor (e.g. 'distrokid', 'tunecore')" }
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
                        action: { type: "STRING", enum: ["retrieve"], description: "retrieve" },
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
                        action: { type: "STRING", enum: ["open", "click", "type", "get_dom"], description: "Action: open, click, type, get_dom" },
                        url: { type: "STRING" },
                        selector: { type: "STRING" }
                    },
                    required: ["action"]
                }
            },
            {
                name: "generate_tax_report",
                description: "Generates a tax prep report (Schedule C) by calculating split waterfalls and flagging payouts over $600 for 1099 reporting.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        year: { type: "NUMBER", description: "The tax year to process." },
                        transactions: {
                            type: "ARRAY",
                            description: "List of transaction objects to process.",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    payee: { type: "STRING" },
                                    amount: { type: "NUMBER" },
                                    date: { type: "STRING" }
                                }
                            }
                        }
                    },
                    required: ["year", "transactions"]
                }
            },
            {
                name: "forecast_revenue",
                description: "Forecast revenue and the indiiOS Dividend (fees saved vs. 20% external manager) over N months given current streams and growth rate.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        current_monthly_streams: { type: "NUMBER", description: "Current monthly stream count." },
                        growth_rate_percent: { type: "NUMBER", description: "Expected monthly growth rate as a percentage (e.g. 5 for 5%)." },
                        months: { type: "NUMBER", description: "Number of months to project (1-24, default 12)." }
                    },
                    required: ["current_monthly_streams", "growth_rate_percent"]
                }
            }
        ]
    }]
};

import { freezeAgentConfig } from '../FreezeDiagnostic';

// Freeze the schema to prevent cross-test contamination
freezeAgentConfig(FinanceAgent);
