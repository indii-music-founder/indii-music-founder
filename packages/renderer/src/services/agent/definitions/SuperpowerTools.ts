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
    },
    // ── Timeline Orchestrator Tools ─────────────────────────────────────────
    {
        name: 'create_timeline',
        description: 'Create a progressive, multi-phase campaign timeline. Supports pre-built templates (single_release_8w, album_rollout_16w, merch_drop_4w, tour_promo_12w) or fully custom AI-generated plans.',
        parameters: {
            type: 'OBJECT',
            properties: {
                goal: { type: 'STRING', description: 'Campaign goal (e.g., "Release my new single \'Midnight Sun\' on April 15").' },
                domain: { type: 'STRING', description: `Primary agent domain. Valid IDs: ${VALID_AGENT_IDS_LIST}` },
                durationWeeks: { type: 'NUMBER', description: 'Total campaign duration in weeks (e.g., 8 for a single release).' },
                startDate: { type: 'STRING', description: 'Campaign start date in ISO format (e.g., "2026-04-01").' },
                templateId: { type: 'STRING', description: 'Optional template ID: single_release_8w, album_rollout_16w, merch_drop_4w, tour_promo_12w, or custom.' },
                platforms: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Target platforms (e.g., ["Instagram", "TikTok", "Twitter"]).' },
                releaseId: { type: 'STRING', description: 'Optional: ID of the release this timeline supports.' },
                customInstructions: { type: 'STRING', description: 'Optional: custom AI instructions for plan generation.' },
                assetStrategy: { type: 'STRING', description: 'Asset preference: create_new, use_existing, or auto.' }
            },
            required: ['goal', 'domain', 'durationWeeks', 'startDate']
        }
    },
    {
        name: 'list_timelines',
        description: 'List all progressive campaign timelines for the current user with progress summaries.',
        parameters: {
            type: 'OBJECT',
            properties: {
                status: { type: 'STRING', description: 'Optional filter: draft, active, paused, completed, cancelled.' }
            }
        }
    },
    {
        name: 'get_timeline_status',
        description: 'Get detailed progress of a specific timeline including current phase, upcoming milestones, and completion percentage.',
        parameters: {
            type: 'OBJECT',
            properties: {
                timelineId: { type: 'STRING', description: 'The timeline ID to check.' }
            },
            required: ['timelineId']
        }
    },
    {
        name: 'activate_timeline',
        description: 'Activate a draft timeline so its milestones start firing on schedule.',
        parameters: {
            type: 'OBJECT',
            properties: {
                timelineId: { type: 'STRING', description: 'The timeline ID to activate.' }
            },
            required: ['timelineId']
        }
    },
    {
        name: 'pause_timeline',
        description: 'Pause an active timeline. Milestones will not fire until resumed.',
        parameters: {
            type: 'OBJECT',
            properties: {
                timelineId: { type: 'STRING', description: 'The timeline ID to pause.' }
            },
            required: ['timelineId']
        }
    },
    {
        name: 'resume_timeline',
        description: 'Resume a paused timeline so milestones continue firing.',
        parameters: {
            type: 'OBJECT',
            properties: {
                timelineId: { type: 'STRING', description: 'The timeline ID to resume.' }
            },
            required: ['timelineId']
        }
    },
    {
        name: 'advance_phase',
        description: 'Skip to the next phase, marking remaining milestones in the current phase as skipped.',
        parameters: {
            type: 'OBJECT',
            properties: {
                timelineId: { type: 'STRING', description: 'The timeline ID.' }
            },
            required: ['timelineId']
        }
    },
    {
        name: 'adjust_cadence',
        description: 'Change the posting frequency of a phase mid-campaign (sparse, moderate, intense, daily).',
        parameters: {
            type: 'OBJECT',
            properties: {
                timelineId: { type: 'STRING', description: 'The timeline ID.' },
                phaseId: { type: 'STRING', description: 'The phase ID to adjust.' },
                cadence: { type: 'STRING', enum: ['sparse', 'moderate', 'intense', 'daily'], description: 'New cadence level.' }
            },
            required: ['timelineId', 'phaseId', 'cadence']
        }
    },
    {
        name: 'list_timeline_templates',
        description: 'List all available progressive campaign templates with descriptions and recommended durations.',
        parameters: {
            type: 'OBJECT',
            properties: {}
        }
    }
];
