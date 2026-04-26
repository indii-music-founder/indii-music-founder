import type { WorkflowStep, WorkflowEdge } from './types';
import { validateWorkflowGraph } from './WorkflowGraphUtils';


export type WorkflowDefinition = {
    id: string;
    name: string;
    description: string;
    steps: WorkflowStep[];
    edges: WorkflowEdge[];
};

export const WORKFLOW_REGISTRY: Record<string, WorkflowDefinition> = {
    'CAMPAIGN_LAUNCH': {
        id: 'CAMPAIGN_LAUNCH',
        name: 'Campaign Launch',
        description: 'Guided multi-agent flow for a full music production release.',
        steps: [
            {
                id: 'brand_analysis',
                agentId: 'brand',
                prompt: 'Analyze the brand consistency and identity for this project based on current assets.',
                priority: 'HIGH'
            },
            {
                id: 'press_release',
                agentId: 'publicist',
                prompt: 'Generate a professional press release and PDF for this campaign.',
                priority: 'MEDIUM'
            },
            {
                id: 'marketing_strategy',
                agentId: 'marketing',
                prompt: 'Analyze current market trends and provide a 4-week marketing strategy for this release.',
                priority: 'MEDIUM'
            },
            {
                id: 'social_drafts',
                agentId: 'social',
                prompt: 'Prepare at least 3 social drop post drafts (TikTok, Instagram, Twitter) for this campaign.',
                priority: 'LOW'
            }
        ],
        edges: [
            { from: 'brand_analysis', to: 'press_release' },
            { from: 'brand_analysis', to: 'marketing_strategy' },
            { from: 'press_release', to: 'social_drafts' },
            { from: 'marketing_strategy', to: 'social_drafts' }
        ]
    },
    'AI_MERCH_DROP': {
        id: 'AI_MERCH_DROP',
        name: 'AI Merch Drop',
        description: 'Generate and plan a merchandise collection drop.',
        steps: [
            {
                id: 'design_concepts',
                agentId: 'creative',
                prompt: 'Generate 5 high-fidelity t-shirt and hoodie design concepts using current brand assets.',
                priority: 'HIGH'
            },
            {
                id: 'pricing_strategy',
                agentId: 'marketing',
                prompt: 'Create a product description and pricing strategy for this merch drop.',
                priority: 'MEDIUM'
            },
            {
                id: 'teaser_campaign',
                agentId: 'social',
                prompt: 'Craft a teaser social media campaign for the upcoming merch drop.',
                priority: 'LOW'
            }
        ],
        edges: [
            { from: 'design_concepts', to: 'pricing_strategy' },
            { from: 'design_concepts', to: 'teaser_campaign' }
        ]
    },
    'SECURITY_AUDIT': {
        id: 'SECURITY_AUDIT',
        name: 'Security Audit',
        description: 'Comprehensive security and dependency audit.',
        steps: [
            {
                id: 'npm_audit',
                agentId: 'devops',
                prompt: 'Run an NPM audit to identify high-severity vulnerabilities.',
                priority: 'HIGH'
            },
            {
                id: 'firebase_audit',
                agentId: 'devops',
                prompt: 'Analyze Firebase security rules for potential data leaks.',
                priority: 'HIGH'
            }
        ],
        edges: []
    },
    'TOUR_PLANNING': {
        id: 'TOUR_PLANNING',
        name: 'Tour Planning',
        description: 'End-to-end multi-agent tour management planning.',
        steps: [
            {
                id: 'demographics',
                agentId: 'marketing',
                prompt: 'Analyze fan demographics to propose 5 optimal tour cities.',
                priority: 'HIGH'
            },
            {
                id: 'budgeting',
                agentId: 'finance',
                prompt: 'Draft an initial tour budget based on venue capacities and standard travel costs.',
                priority: 'HIGH'
            },
            {
                id: 'press_announcement',
                agentId: 'publicist',
                prompt: 'Create a tour announcement press release template.',
                priority: 'MEDIUM'
            },
            {
                id: 'social_teaser',
                agentId: 'social',
                prompt: 'Draft a 3-week social media teaser campaign for the pending tour announcement.',
                priority: 'LOW'
            }
        ],
        edges: [
            { from: 'demographics', to: 'budgeting' },
            { from: 'demographics', to: 'press_announcement' },
            { from: 'press_announcement', to: 'social_teaser' }
        ]
    },
    'INDII_GROWTH_PROTOCOL': {
        id: 'INDII_GROWTH_PROTOCOL',
        name: 'indii Growth Protocol',
        description: 'Automated Meta Andromeda creative pipeline and 28-day algorithmic spike campaign.',
        steps: [
            {
                id: 'video_generation',
                agentId: 'workflow',
                prompt: 'Trigger a Node recipe instructing the Video Agent (using veo-3.1-generate-preview) to mass-generate 6 to 15 unique 9:16 vertical video variations. Enforce the 3-Second Hook rule.',
                priority: 'URGENT'
            },
            {
                id: 'ad_deployment',
                agentId: 'marketing',
                prompt: 'Deploy all creative variations simultaneously with a $5-$10 daily budget. Enforce strict Instagram-Only placements. Monitor CTR and Save Rates, autonomously kill losing creatives by Day 3, and scale the winners.',
                priority: 'HIGH'
            }
        ],
        edges: [
            { from: 'video_generation', to: 'ad_deployment' }
        ]
    }
};

// Validate all workflows on load to prevent cyclic dependencies
Object.values(WORKFLOW_REGISTRY).forEach(workflow => {
    try {
        validateWorkflowGraph(workflow);
    } catch (error) {
        console.error(`[WorkflowRegistry] Validation failed for ${workflow.id}:`, error);
        // In a production environment, we might just log, but in dev we want to know.
        if (process.env.NODE_ENV === 'development') {
            throw error;
        }
    }
});
