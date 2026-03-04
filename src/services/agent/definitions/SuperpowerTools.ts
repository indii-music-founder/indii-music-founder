import { FunctionDeclaration } from '../types';
import { VALID_AGENT_IDS_LIST } from '../types';

/**
 * SUPERPOWER_TOOLS defines the advanced cross-cutting capabilities available to all agents.
 * These include memory management, delegation, reflection, and proactive notifications.
 */
export const SUPERPOWER_TOOLS: FunctionDeclaration[] = [
    {
        name: 'save_memory',
        description: 'Save a fact, rule, or preference to long-term memory.',
        parameters: {
            type: 'OBJECT',
            properties: {
                content: { type: 'STRING', description: 'The content to remember.' },
                type: { type: 'STRING', description: 'Type of memory.', enum: ['fact', 'summary', 'rule'] }
            },
            required: ['content']
        }
    },
    {
        name: 'recall_memories',
        description: 'Search long-term memory for relevant information.',
        parameters: {
            type: 'OBJECT',
            properties: {
                query: { type: 'STRING', description: 'Search query.' }
            },
            required: ['query']
        }
    },
    {
        name: 'verify_output',
        description: 'Critique and verify generated content against a goal.',
        parameters: {
            type: 'OBJECT',
            properties: {
                goal: { type: 'STRING', description: 'The original goal.' },
                content: { type: 'STRING', description: 'The content to verify.' }
            },
            required: ['goal', 'content']
        }
    },
    {
        name: 'request_approval',
        description: 'Request user approval for high-stakes actions.',
        parameters: {
            type: 'OBJECT',
            properties: {
                content: { type: 'STRING', description: 'Content or action requiring approval.' },
                type: { type: 'STRING', description: 'Type of action (e.g., "post", "email").' }
            },
            required: ['content']
        }
    },
    {
        name: 'get_project_details',
        description: 'Fetch full details of a project by ID.',
        parameters: {
            type: 'OBJECT',
            properties: {
                projectId: { type: 'STRING', description: 'The ID of the project to fetch.' }
            },
            required: ['projectId']
        }
    },
    {
        name: 'search_knowledge',
        description: 'Search the internal knowledge base for answers, guidelines, or policies.',
        parameters: {
            type: 'OBJECT',
            properties: {
                query: { type: 'STRING', description: 'The search query.' }
            },
            required: ['query']
        }
    },
    {
        name: 'delegate_task',
        description: `Delegate a sub-task to another specialized agent. ONLY use valid agent IDs from this list: ${VALID_AGENT_IDS_LIST}. Using any other ID will fail.`,
        parameters: {
            type: 'OBJECT',
            properties: {
                targetAgentId: { type: 'STRING', description: `The ID of the agent to delegate to. MUST be one of: ${VALID_AGENT_IDS_LIST}` },
                task: { type: 'STRING', description: 'The specific task for the agent to perform.' }
            },
            required: ['targetAgentId', 'task']
        }
    },
    {
        name: 'consult_experts',
        description: 'Consult multiple specialized agents in parallel to get diverse perspectives on a complex sub-task.',
        parameters: {
            type: 'OBJECT',
            properties: {
                consultations: {
                    type: 'ARRAY',
                    description: 'List of specific tasks to delegate to specialized agents.',
                    items: {
                        type: 'OBJECT',
                        properties: {
                            targetAgentId: { type: 'STRING', description: `The ID of the agent to consult. MUST be one of: ${VALID_AGENT_IDS_LIST}` },
                            task: { type: 'STRING', description: 'The specific question or instruction for this specialist.' }
                        },
                        required: ['targetAgentId', 'task']
                    }
                }
            },
            required: ['consultations']
        }
    },
    {
        name: 'speak',
        description: 'Read text aloud using the agents voice. Use this for proactive notifications or to emphasize important information.',
        parameters: {
            type: 'OBJECT',
            properties: {
                text: { type: 'STRING', description: 'The text to read aloud.' },
                voice: { type: 'STRING', description: 'Optional voice override (e.g., Kore, Puck, Charon, Vega, Capella).' }
            },
            required: ['text']
        }
    },
    {
        name: 'schedule_task',
        description: 'Schedule a task to be executed automatically after a delay (e.g., follow-ups, reminders).',
        parameters: {
            type: 'OBJECT',
            properties: {
                targetAgentId: { type: 'STRING', description: `Agent to execute. Valid IDs: ${VALID_AGENT_IDS_LIST}` },
                task: { type: 'STRING', description: 'The instruction to execute.' },
                delayMinutes: { type: 'NUMBER', description: 'Minutes to wait before execution.' }
            },
            required: ['targetAgentId', 'task', 'delayMinutes']
        }
    },
    {
        name: 'subscribe_to_event',
        description: 'Subscribe to a system event to trigger an autonomous response (e.g., when a task completes).',
        parameters: {
            type: 'OBJECT',
            properties: {
                eventType: {
                    type: 'STRING',
                    enum: ['TASK_COMPLETED', 'TASK_FAILED', 'SYSTEM_ALERT'],
                    description: 'The type of event to monitor.'
                },
                task: { type: 'STRING', description: 'The instruction to execute when the event occurs.' }
            },
            required: ['eventType', 'task']
        }
    },
    {
        name: 'send_notification',
        description: 'Display a proactive notification (toast) to the user.',
        parameters: {
            type: 'OBJECT',
            properties: {
                type: {
                    type: 'STRING',
                    enum: ['info', 'success', 'warning', 'error'],
                    description: 'The style of the notification.'
                },
                message: { type: 'STRING', description: 'The message to display.' }
            },
            required: ['type', 'message']
        }
    }
];
