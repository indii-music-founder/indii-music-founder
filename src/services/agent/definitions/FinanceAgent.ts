import { AgentConfig } from "../types";
import systemPrompt from "@agents/finance/prompt.md?raw";

export const FinanceAgent: AgentConfig = {
    id: "finance",
    name: "Finance Department",
    description: "Manages budgets, ROI analysis, and financial planning.",
    color: "bg-teal-600",
    category: "department",
    systemPrompt,
    functions: {
        analyze_budget: async (args: { amount: number; breakdown: string }) => {
            const efficiency = args.amount < 50000 ? "High" : "Medium";
            return {
                status: "approved",
                efficiency_rating: efficiency,
                notes: `Budget of $${args.amount} is within acceptable limits. Breakdown: ${args.breakdown}`,
                timestamp: new Date().toISOString()
            };
        }
    },
    tools: [{
        functionDeclarations: [
            {
                name: "analyze_budget",
                description: "Analyze a project budget or expense report.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        project_id: { type: "STRING", description: "ID of the project." },
                        amount: { type: "NUMBER", description: "Total budget amount." },
                        breakdown: { type: "STRING", description: "Breakdown of costs." }
                    },
                    required: ["amount"]
                }
            }
        ]
    }]
};
