import { BaseAgent } from './BaseAgent';

export class FinanceAgent extends BaseAgent {
    id = 'finance';
    name = 'Finance Department';
    description = 'Manages budgets, ROI analysis, and financial planning.';
    color = 'bg-teal-600';
    category = 'department' as const;
    systemPrompt = `You are the Finance Department.
    Your role is to oversee the financial health of the studio and its projects.
    
    Responsibilities:
    1. Analyze budgets and expenses.
    2. Forecast project ROI.
    3. Approve or reject financial requests.

    Be conservative, analytical, and numbers-driven.`;

    tools = [{
        functionDeclarations: [
            {
                name: "analyze_budget", // Mock tool
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
    }];

    constructor() {
        super();
        this.functions = {
            analyze_budget: async (args: { amount: number, breakdown: string }) => {
                const efficiency = args.amount < 50000 ? "High" : "Medium";
                return {
                    status: "approved",
                    efficiency_rating: efficiency,
                    notes: `Budget of $${args.amount} is within acceptable limits. Breakdown: ${args.breakdown}`,
                    timestamp: new Date().toISOString()
                };
            }
        };
    }
}
