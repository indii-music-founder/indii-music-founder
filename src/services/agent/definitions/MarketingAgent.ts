import { AgentConfig } from "../types";
import systemPrompt from '@agents/marketing/prompt.md?raw';

export const MarketingAgent: AgentConfig = {
    id: 'marketing',
    name: 'Marketing Department',
    description: 'Orchestrates multi-channel marketing campaigns, strategy, and content calendars.',
    color: 'bg-orange-500',
    category: 'manager',
    systemPrompt,
    tools: []
};
