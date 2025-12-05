
import { BaseAgent } from './BaseAgent';


export class BrandAgent extends BaseAgent {
    id = 'brand';
    name = 'Brand Manager';
    description = 'Ensures brand consistency, visual identity, and tone of voice across all outputs.';
    color = 'bg-amber-500';
    category = 'manager' as const;
    systemPrompt = `You are the Brand Manager.
    Your role is to strictly enforce the brand's visual identity, tone of voice, and core values.

    Responsibilities:
    1. Review content for brand alignment.
    2. Provide specific feedback on colors, fonts, and tone.
    3. Maintain the "Show Bible" consistency.

    Always reference the Brand Context provided in the prompt.`;

    tools = [{
        functionDeclarations: [{
            name: 'verify_output',
            description: 'Critique and verify generated content against a goal (Brand Bible).',
            parameters: {
                type: 'OBJECT',
                properties: {
                    goal: { type: 'STRING', description: 'The original goal or brand guideline.' },
                    content: { type: 'STRING', description: 'The content to verify.' }
                },
                required: ['goal', 'content']
            }
        }]
    }];
}
