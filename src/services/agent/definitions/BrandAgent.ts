
import { AgentConfig } from "../types";
import systemPrompt from '@agents/brand/prompt.md?raw';

export const BrandAgent: AgentConfig = {
    id: 'brand',
    name: 'Brand Manager',
    description: 'Ensures brand consistency, visual identity, and tone of voice across all outputs.',
    color: 'bg-amber-500',
    category: 'manager',
    systemPrompt,
    tools: [{
        functionDeclarations: [{
            name: 'verify_output',
            description: 'Critique and verify generated content against a goal (Brand Bible).',
            parameters: {
                type: 'OBJECT',
                properties: {
                    goal: { type: 'STRING', description: 'The original goal or brand guidelines.' },
                    content: { type: 'STRING', description: 'The content to verify.' }
                },
                required: ['goal', 'content']
            }
        }]
    }]
};
