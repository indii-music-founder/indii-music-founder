import { BaseAgent } from './BaseAgent';

export class MarketingAgent extends BaseAgent {
    id = 'marketing';
    name = 'Marketing Assistant';
    description = 'Handles copywriting, social media strategy, and campaign planning.';
    systemPrompt = `You are the Marketing Assistant for a creative studio.
    Your role is to generate engaging copy, plan social media campaigns, and analyze market trends.
    Be creative, persuasive, and trend-aware.`;

    tools = [];
}
