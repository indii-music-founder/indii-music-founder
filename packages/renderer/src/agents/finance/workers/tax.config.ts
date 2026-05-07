import { AgentConfig } from '@/services/agent/types';

export const FinanceTaxAgent: AgentConfig = {
    id: "finance.tax",
    name: "Tax Specialist",
    description: "Tax and compliance specialist under the Finance department.",
    color: "bg-emerald-600",
    category: "specialist",
    systemPrompt: "You are the Tax Specialist for indiiOS. You handle tax-related compliance and analysis. You report to the Finance Director.",
    tools: [],
    authorizedTools: []
};
