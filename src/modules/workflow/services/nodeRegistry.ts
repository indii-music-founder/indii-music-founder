import React from 'react';
import { Paintbrush, Video, Megaphone, Users, Box, Search, FileText, Music, Cog, Split, ShieldCheck, Database } from 'lucide-react';

export type DataType = 'TRIGGER' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'CONTEXT' | 'ANY';

export const DATA_TYPE_COLORS: Record<DataType, string> = {
    TRIGGER: '#e5e7eb', // gray-200
    TEXT: '#94a3b8',    // slate-400
    IMAGE: '#2dd4bf',   // teal-400
    VIDEO: '#c084fc',   // purple-400
    AUDIO: '#fbbf24',   // amber-400
    CONTEXT: '#38bdf8', // sky-400
    ANY: '#6b7280',     // gray-500
};

export interface PortDefinition {
    id: string;
    label: string;
    type: DataType;
    required?: boolean;
}

export interface NodeJob {
    id: string;
    label: string;
    description: string;
    defaultPrompt: string;
    inputs: PortDefinition[];
    outputs: PortDefinition[];
}

export interface NodeDefinition {
    departmentName: string;
    label: string;
    icon: React.ElementType;
    jobs: NodeJob[];
}

// Mock department configs for now
const departmentConfigs = [
    { name: 'Art Department', templates: [{ title: 'Concept Art', description: 'Generate concept art', prompt: 'Concept art of...' }] },
    { name: 'Marketing Department', templates: [{ title: 'Ad Copy', description: 'Write ad copy', prompt: 'Write ad copy for...' }] },
    { name: 'Social Media Department', templates: [{ title: 'Tweet', description: 'Write a tweet', prompt: 'Write a tweet about...' }] },
    { name: 'Campaign Manager', templates: [{ title: 'Campaign Strategy', description: 'Plan a campaign', prompt: 'Plan a campaign for...' }] },
];

// Helper to map existing templates to jobs with assumed types
const mapTemplatesToJobs = (deptName: string, defaultOutputType: DataType = 'TEXT'): NodeJob[] => {
    const config = departmentConfigs.find(d => d.name === deptName);
    const templates = (config as any)?.templates || [];

    const jobs: NodeJob[] = templates.map((t: any, i: number) => ({
        id: `${deptName.toLowerCase().replace(/\s/g, '-')}-job-${i}`,
        label: t.title,
        description: t.description,
        defaultPrompt: t.prompt,
        inputs: [
            { id: 'trigger', label: 'Start', type: 'TRIGGER' },
            { id: 'context', label: 'Context', type: 'CONTEXT' },
            { id: 'text_input', label: 'Instructions', type: 'TEXT' }
        ],
        outputs: [
            { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
            { id: 'result', label: 'Output', type: defaultOutputType }
        ]
    }));

    // Add a generic "Custom Task" job
    jobs.unshift({
        id: 'custom',
        label: 'Custom Task',
        description: 'Write a custom instruction for this department.',
        defaultPrompt: '',
        inputs: [
            { id: 'trigger', label: 'Start', type: 'TRIGGER' },
            { id: 'input', label: 'Input', type: 'ANY' }
        ],
        outputs: [
            { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
            { id: 'output', label: 'Result', type: 'ANY' }
        ]
    });

    return jobs;
};

export const NODE_REGISTRY: Record<string, NodeDefinition> = {
    'Art Department': {
        departmentName: 'Art Department',
        label: 'Art Department',
        icon: Paintbrush,
        jobs: [
            ...mapTemplatesToJobs('Art Department', 'IMAGE'),
            {
                id: 'art-upscale',
                label: 'Upscale/Refine Image',
                description: 'Take an input image and increase detail or variation.',
                defaultPrompt: 'Upscale this image, adding more detail and texture while preserving the original composition.',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'image_input', label: 'Source Image', type: 'IMAGE', required: true }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'image_output', label: 'Refined Image', type: 'IMAGE' }
                ]
            }
        ]
    },
    'Video Department': {
        departmentName: 'Video Department',
        label: 'Video Department',
        icon: Video,
        jobs: [
            ...mapTemplatesToJobs('Video Department', 'VIDEO'),
            {
                id: 'video-img-to-video',
                label: 'Animate Image (Img2Vid)',
                description: 'Turn a static image into a video clip.',
                defaultPrompt: 'Cinematic camera movement, bringing the scene to life.',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'image_input', label: 'Start Frame', type: 'IMAGE', required: true },
                    { id: 'text_input', label: 'Prompt', type: 'TEXT' }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'video_output', label: 'Video', type: 'VIDEO' }
                ]
            },
            {
                id: 'video-extend',
                label: 'Extend Video',
                description: 'Continue the action from a previous video clip.',
                defaultPrompt: 'Continue the action seamlessly.',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'video_input', label: 'Input Video', type: 'VIDEO', required: true },
                    { id: 'text_input', label: 'Prompt', type: 'TEXT' }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'video_output', label: 'Extended Video', type: 'VIDEO' }
                ]
            }
        ]
    },
    'Marketing Department': {
        departmentName: 'Marketing Department',
        label: 'Marketing Dept',
        icon: Megaphone,
        jobs: mapTemplatesToJobs('Marketing Department', 'TEXT')
    },
    'Social Media Department': {
        departmentName: 'Social Media Department',
        label: 'Social Media Dept',
        icon: Users,
        jobs: mapTemplatesToJobs('Social Media Department', 'TEXT')
    },
    'Campaign Manager': {
        departmentName: 'Campaign Manager',
        label: 'Campaign Manager',
        icon: Box,
        jobs: mapTemplatesToJobs('Campaign Manager', 'TEXT') // Returns JSON strictly, but treated as text/doc
    },
    'Knowledge Base': {
        departmentName: 'Knowledge Base',
        label: 'Knowledge Base',
        icon: Search,
        jobs: [
            {
                id: 'kb-query',
                label: 'Query Knowledge Base',
                description: 'Ask a question based on your uploaded documents.',
                defaultPrompt: 'What does my brand guide say about...',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'query', label: 'Question', type: 'TEXT', required: true }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'answer', label: 'Answer', type: 'TEXT' }
                ]
            }
        ]
    }
};

export const LOGIC_REGISTRY: Record<string, NodeDefinition> = {
    'Logic': {
        departmentName: 'Logic',
        label: 'Logic & Control',
        icon: Cog,
        jobs: [
            {
                id: 'router',
                label: 'Router (Switch)',
                description: 'Branch execution based on a logic condition.',
                defaultPrompt: '',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'data', label: 'Data to Check', type: 'ANY', required: true }
                ],
                outputs: [
                    { id: 'true', label: 'True Path', type: 'TRIGGER' },
                    { id: 'false', label: 'False Path', type: 'TRIGGER' }
                ]
            },
            {
                id: 'gatekeeper',
                label: 'Gatekeeper (Approval)',
                description: 'Pause execution and wait for user approval. Persists state.',
                defaultPrompt: '',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'data', label: 'Asset to Approve', type: 'ANY', required: true }
                ],
                outputs: [
                    { id: 'approve', label: 'Approved', type: 'TRIGGER' },
                    { id: 'reject', label: 'Rejected', type: 'TRIGGER' }
                ]
            }
        ]
    },
    'Variables': {
        departmentName: 'Variables',
        label: 'Blackboard Variables',
        icon: Database,
        jobs: [
            {
                id: 'set_variable',
                label: 'Set Variable',
                description: 'Store a value in the global blackboard memory.',
                defaultPrompt: '',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'value', label: 'Value', type: 'ANY', required: true }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' }
                ]
            },
            {
                id: 'get_variable',
                label: 'Get Variable',
                description: 'Retrieve a value from the global blackboard memory.',
                defaultPrompt: '',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'value', label: 'Value', type: 'ANY' }
                ]
            }
        ]
    }
};

export const getNodeDefinition = (departmentName: string): NodeDefinition | null => {
    if (departmentName === 'Logic') return LOGIC_REGISTRY['Logic'];
    if (departmentName === 'Variables') return LOGIC_REGISTRY['Variables'];
    return NODE_REGISTRY[departmentName] || null;
};

export const getJobDefinition = (departmentName: string, jobId?: string): NodeJob | null => {
    const def = getNodeDefinition(departmentName);
    if (!def) return null;
    return def.jobs.find(j => j.id === jobId) || def.jobs[0];
};
