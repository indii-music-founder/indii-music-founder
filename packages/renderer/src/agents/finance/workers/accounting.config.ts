import { AgentConfig } from '@/services/agent/types';

export const FinanceAccountingAgent: AgentConfig = {
    id: "finance.accounting",
    name: "Accounting Specialist",
    description: "Bookkeeping and accounting specialist under the Finance department.",
    color: "bg-emerald-600",
    category: "specialist",
    systemPrompt: "You are the Accounting Specialist for indiiOS. You manage day-to-day bookkeeping, receipt categorization, and P&L statements. You report to the Finance Director.",
    tools: [],
    authorizedTools: []
};
