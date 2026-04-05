
export type WorkflowStep = {
    agentId: string;
    prompt: string;
    priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
    dependency?: string; // ID of a step that must complete first
};

export type WorkflowDefinition = {
    id: string;
    name: string;
    description: string;
    steps: WorkflowStep[];
};

export const WORKFLOW_REGISTRY: Record<string, WorkflowDefinition> = {
    'CAMPAIGN_LAUNCH': {
        id: 'CAMPAIGN_LAUNCH',
        name: 'Campaign Launch',
        description: 'Guided multi-agent flow for a full music production release.',
        steps: [
            {
                agentId: 'brand',
                prompt: 'Analyze the brand consistency and identity for this project based on current assets.',
                priority: 'HIGH'
            },
            {
                agentId: 'publicist',
                prompt: 'Generate a professional press release and PDF for this campaign.',
                priority: 'MEDIUM'
            },
            {
                agentId: 'marketing',
                prompt: 'Analyze current market trends and provide a 4-week marketing strategy for this release.',
                priority: 'MEDIUM'
            },
            {
                agentId: 'social',
                prompt: 'Prepare at least 3 social drop post drafts (TikTok, Instagram, Twitter) for this campaign.',
                priority: 'LOW'
            }
        ]
    },
    'AI_MERCH_DROP': {
        id: 'AI_MERCH_DROP',
        name: 'AI Merch Drop',
        description: 'Generate and plan a merchandise collection drop.',
        steps: [
            {
                agentId: 'creative',
                prompt: 'Generate 5 high-fidelity t-shirt and hoodie design concepts using current brand assets.',
                priority: 'HIGH'
            },
            {
                agentId: 'marketing',
                prompt: 'Create a product description and pricing strategy for this merch drop.',
                priority: 'MEDIUM'
            },
            {
                agentId: 'social',
                prompt: 'Craft a teaser social media campaign for the upcoming merch drop.',
                priority: 'LOW'
            }
        ]
    },
    'SECURITY_AUDIT': {
        id: 'SECURITY_AUDIT',
        name: 'Security Audit',
        description: 'Comprehensive security and dependency audit.',
        steps: [
            {
                agentId: 'devops',
                prompt: 'Run an NPM audit to identify high-severity vulnerabilities.',
                priority: 'HIGH'
            },
            {
                agentId: 'devops',
                prompt: 'Analyze Firebase security rules for potential data leaks.',
                priority: 'HIGH'
            }
        ]
    },
    'TOUR_PLANNING': {
        id: 'TOUR_PLANNING',
        name: 'Tour Planning',
        description: 'End-to-end multi-agent tour management planning.',
        steps: [
            {
                agentId: 'marketing',
                prompt: 'Analyze fan demographics to propose 5 optimal tour cities.',
                priority: 'HIGH'
            },
            {
                agentId: 'finance',
                prompt: 'Draft an initial tour budget based on venue capacities and standard travel costs.',
                priority: 'HIGH'
            },
            {
                agentId: 'publicist',
                prompt: 'Create a tour announcement press release template.',
                priority: 'MEDIUM'
            },
            {
                agentId: 'social',
                prompt: 'Draft a 3-week social media teaser campaign for the pending tour announcement.',
                priority: 'LOW'
            }
        ]
    },
    'INDII_GROWTH_PROTOCOL': {
        id: 'INDII_GROWTH_PROTOCOL',
        name: 'indii Growth Protocol',
        description: 'Automated Meta Andromeda creative pipeline and 28-day algorithmic spike campaign.',
        steps: [
            {
                agentId: 'workflow',
                prompt: 'Trigger a Node recipe instructing the Video Agent (using veo-3.1-generate-preview) to mass-generate 6 to 15 unique 9:16 vertical video variations. Enforce the 3-Second Hook rule.',
                priority: 'URGENT'
            },
            {
                agentId: 'marketing',
                prompt: 'Deploy all creative variations simultaneously with a $5-$10 daily budget. Enforce strict Instagram-Only placements. Monitor CTR and Save Rates, autonomously kill losing creatives by Day 3, and scale the winners.',
                priority: 'HIGH'
            }
        ]
    }
};
