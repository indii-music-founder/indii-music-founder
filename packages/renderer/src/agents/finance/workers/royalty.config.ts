import { AgentConfig } from '@/services/agent/types';

export const FinanceRoyaltyAgent: AgentConfig = {
    id: "finance.royalty",
    name: "Royalty Specialist",
    description: "Royalty tracking and calculations specialist under the Finance department.",
    color: "bg-emerald-600",
    category: "specialist",
    systemPrompt: "You are the Royalty Specialist for indiiOS. You track streams, calculate waterfalls, and manage royalty payouts. You report to the Finance Director.",
    tools: [],
    authorizedTools: []
};
