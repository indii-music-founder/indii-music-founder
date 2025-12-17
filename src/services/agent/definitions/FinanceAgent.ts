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
                success: true,
                data: {
                    status: "approved",
                    efficiency_rating: efficiency,
                    notes: `Budget of $${args.amount} is within acceptable limits. Breakdown: ${args.breakdown}`,
                    timestamp: new Date().toISOString()
                }
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
            },
            {
                name: "execute_bigquery_query",
                description: "Execute a SQL query on the company's BigQuery data warehouse to retrieve sales, revenue, or budget data.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "Standard SQL query." }
                    },
                    required: ["query"]
                }
            },
            {
                name: "get_table_schema",
                description: "Get the schema of a specific BigQuery table to understand available fields.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        table_id: { type: "STRING", description: "Table ID (e.g. 'sales_data', 'quarterly_budget')." }
                    },
                    required: ["table_id"]
                }
            }
        ]
    }]
};
