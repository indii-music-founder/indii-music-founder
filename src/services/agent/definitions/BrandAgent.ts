
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
        functionDeclarations: [
            {
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
            },
            {
                name: 'analyze_brand_consistency',
                description: 'Analyze content for tone, core values, and visual consistency.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        content: { type: 'STRING', description: 'The text or asset description to analyze.' },
                        type: { type: 'STRING', description: 'Type of content (e.g., "social post", "email", "image").' }
                    },
                    required: ['content', 'type']
                }
            },
            {
                name: 'generate_brand_guidelines',
                description: 'Generate structured brand guidelines based on core values.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        name: { type: 'STRING', description: 'Name of the brand.' },
                        values: { type: 'ARRAY', description: 'List of core values.', items: { type: 'STRING' } }
                    },
                    required: ['name', 'values']
                }
            },
            {
                name: 'audit_visual_assets',
                description: 'Audit a list of visual assets for compliance.',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        assets: { type: 'ARRAY', description: 'List of asset URLs or names to audit.', items: { type: 'STRING' } }
                    },
                    required: ['assets']
                }
            }
        ]
    }]
};
