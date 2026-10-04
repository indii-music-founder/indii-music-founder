import { FunctionDeclaration } from '../types';
import { VALID_AGENT_IDS_LIST } from '../types';
import { ARTIFACT_TOOL_DECLARATIONS } from '../tools/ArtifactTools';

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
        name: 'approve_local_asset_folder',
        description: 'Open a Studio folder picker so the creator can explicitly approve one local folder for agent asset discovery. Never assume access to a folder.',
        parameters: { type: 'OBJECT', properties: {} }
    },
    {
        name: 'save_note',
        description: 'Save a text note to the creator\'s Notes module (ideas, decisions, summaries, transcriptions). Use whenever the creator asks to remember or note something.',
        parameters: {
            type: 'OBJECT',
            properties: {
                title: { type: 'STRING', description: 'Short note title. Optional; a timestamped default is used when omitted.' },
                content: { type: 'STRING', description: 'The note body text.' },
            },
            required: ['content']
        }
    },
    {
        name: 'save_media_note',
        description: 'Attach a stored media URL (image, audio, video) to the Notes module, optionally into an existing note.',
        parameters: {
            type: 'OBJECT',
            properties: {
                url: { type: 'STRING', description: 'Stored media URL to attach.' },
                noteId: { type: 'STRING', description: 'Existing note ID to append to. Omit to create a new media note.' },
                description: { type: 'STRING', description: 'What the media shows or contains.' },
            },
            required: ['url']
        }
    },
    {
        name: 'list_notes',
        description: 'Read the creator\'s saved notes (most recent first), optionally filtering by words in the title, body, or tags. Use before claiming nothing is noted down.',
        parameters: {
            type: 'OBJECT',
            properties: {
                query: { type: 'STRING', description: 'Words to match in note titles, bodies, or tags.' },
                limit: { type: 'NUMBER', description: 'Max notes to return (1-25, default 10).' },
            },
        }
    },
    {
        name: 'report_error',
        description: 'File an error report when a tool fails and one retry will not fix it. Send a one-sentence plain-language summary the creator can read, plus the technical detail for the fix team (never shown to the creator). Returns a short report ID to give the creator.',
        parameters: {
            type: 'OBJECT',
            properties: {
                summary: { type: 'STRING', description: 'One-sentence plain-language summary of what failed. Creator-readable; no raw error text or codes.' },
                detail: { type: 'STRING', description: 'Technical detail for the fix team (raw error message, tool name). Never relayed into the conversation.' },
                surface: { type: 'STRING', description: 'Where it happened, e.g. "creative director chat" or "distribution flow".' },
            },
            required: ['summary']
        }
    },
    {
        name: 'browse_local_files',
        description: 'Search metadata from folders the creator previously approved in the open Studio app. Returns names and relative paths only; never file contents or absolute paths.',
        parameters: {
            type: 'OBJECT',
            properties: {
                query: { type: 'STRING', description: 'Words to match in asset names, such as "font logo".' },
                extensions: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Optional extensions, without a dot (for example png, svg, ttf).' }
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
        name: 'share_note',
        description: `Share factual context with another manager or your own manager. This never assigns work. Valid IDs: ${VALID_AGENT_IDS_LIST}`,
        parameters: {
            type: 'OBJECT',
            properties: {
                targetAgentId: { type: 'STRING', description: `Receiving agent. MUST be one of: ${VALID_AGENT_IDS_LIST}` },
                content: { type: 'STRING', description: 'A concise factual note, decision, or context update. Do not phrase as an instruction.' }
            },
            required: ['targetAgentId', 'content']
        }
    },
    {
        name: 'consult_specialist',
        description: 'Consult a specialized agent using Connected Intelligence© (P2P A2A Swarm protocol). Use this to query a specific specialist for targeted advice, cross-domain context, or generation.',
        parameters: {
            type: 'OBJECT',
            properties: {
                targetAgentId: { type: 'STRING', description: `The ID of the agent to consult. MUST be one of: ${VALID_AGENT_IDS_LIST}` },
                payload: { type: 'OBJECT', description: 'The JSON payload or query to send to the specialist.' }
            },
            required: ['targetAgentId', 'payload']
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
        description: 'Create a progressive, multi-phase campaign timeline. Supports pre-built templates (single_release_8w, album_rollout_16w, merch_drop_4w, tour_promo_12w) or fully custom Intelligence-generated plans.',
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
                customInstructions: { type: 'STRING', description: 'Optional: custom Autonomous instructions for plan generation.' },
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
    },
    {
        name: 'audit_architecture',
        description: 'Scans the INDII agent directory to map the current state and capabilities. Use this to audit existing agents and prevent redundant tool creation.',
        parameters: {
            type: 'OBJECT',
            properties: {}
        }
    },
    {
        name: 'update_agent_memory',
        description: "Updates an agent's persistent procedural knowledge (instructions.md). Use this to remember user preferences or enforce new rules across sessions.",
        parameters: {
            type: 'OBJECT',
            properties: {
                agentId: { type: 'STRING', description: "The ID of the agent to update (e.g., 'merchandise', 'generalist')." },
                action: { type: 'STRING', enum: ['add', 'remove'], description: "Whether to add a new instruction or remove an existing string." },
                knowledge: { type: 'STRING', description: "The specific procedural instruction or rule to persist." }
            },
            required: ['agentId', 'action', 'knowledge']
        }
    },
    {
        name: 'list_trash',
        description: 'List items currently in the user-owned Trash vault matching optional resource type or search query.',
        parameters: {
            type: 'OBJECT',
            properties: {
                type: {
                    type: 'STRING',
                    enum: ['file_nodes', 'history', 'brand_assets', 'knowledge_docs', 'local_files'],
                    description: 'Optional resource type filter.'
                },
                query: { type: 'STRING', description: 'Search term matching item name or original location.' }
            }
        }
    },
    {
        name: 'move_to_trash',
        description: 'Move a specific asset or file to the user-owned Trash vault. Requires a stable ID from selection, search, or attachment context. Items moved to Trash can be fully restored by the user or agent.',
        parameters: {
            type: 'OBJECT',
            properties: {
                type: {
                    type: 'STRING',
                    enum: ['file_nodes', 'history', 'brand_assets', 'knowledge_docs', 'local_files'],
                    description: 'Resource type.'
                },
                targetId: { type: 'STRING', description: 'Stable resource ID or relative path.' },
                folderId: { type: 'STRING', description: 'Approved folder ID (required for local_files).' },
                reason: { type: 'STRING', description: 'Clear reason why the item is being moved to trash.' }
            },
            required: ['type', 'targetId']
        }
    },
    {
        name: 'restore_from_trash',
        description: 'Restore a previously trashed item from the Trash vault back to its active location.',
        parameters: {
            type: 'OBJECT',
            properties: {
                trashId: { type: 'STRING', description: 'The unique Trash record ID (e.g. trash_12345).' },
                targetRelativePath: { type: 'STRING', description: 'Optional new relative path if resolving a location conflict.' }
            },
            required: ['trashId']
        }
    },
    {
        name: 'blender_get_status',
        description: 'Check Blender 3D integration status, binary installation path, version, and GPU acceleration capabilities on the host system.',
        parameters: {
            type: 'OBJECT',
            properties: {},
            required: []
        }
    },
    {
        name: 'blender_list_templates',
        description: 'List available procedural 3D music video templates (e.g. audio-reactive tunnels, spectrum analyzers, particles, vinyl turntables).',
        parameters: {
            type: 'OBJECT',
            properties: {},
            required: []
        }
    },
    {
        name: 'blender_render_music_video',
        description: 'Render a procedural 3D music video or audio-reactive visualizer using Blender EEVEE/Cycles.',
        parameters: {
            type: 'OBJECT',
            properties: {
                audioFilePath: { type: 'STRING', description: 'Absolute path to the input audio file (WAV/MP3/AAC).' },
                outputVideoPath: { type: 'STRING', description: 'Absolute destination path for the rendered MP4 video.' },
                templateId: { type: 'STRING', description: 'Template identifier: audio_reactive_tunnel, frequency_spectrum_bars, particle_nebula, neon_grid_horizon, vinyl_turntable, abstract_geometry_morph.' },
                bpm: { type: 'NUMBER', description: 'Optional tempo in BPM to sync visual pulsations and camera motion.' },
                durationSeconds: { type: 'NUMBER', description: 'Duration of the output render in seconds (default 30).' },
                fps: { type: 'NUMBER', description: 'Frames per second (default 30).' },
                resolution: { type: 'STRING', enum: ['720p', '1080p', '4k'], description: 'Render resolution (default 1080p).' },
                aspectRatio: { type: 'STRING', enum: ['16:9', '9:16', '1:1'], description: 'Aspect ratio (default 16:9).' },
                engine: { type: 'STRING', enum: ['BLENDER_EEVEE_NEXT', 'CYCLES'], description: 'Blender render engine (default BLENDER_EEVEE_NEXT).' }
            },
            required: ['audioFilePath', 'outputVideoPath']
        }
    },
    {
        name: 'blender_live_command',
        description: 'Execute a command against a live running Blender instance via the Blender MCP server bridge.',
        parameters: {
            type: 'OBJECT',
            properties: {
                action: { type: 'STRING', description: 'Action to execute (e.g. ping, run_script, get_scene_info).' },
                params: { type: 'OBJECT', description: 'Parameters for the action.' }
            },
            required: ['action']
        }
    },
    {
        name: 'foundry_inspect_format',
        description: 'Run format forensics inspection on arbitrary distributor or royalty file content using deterministic analysis augmented with Jev type-safe semantic judgments.',
        parameters: {
            type: 'OBJECT',
            properties: {
                evidenceId: { type: 'STRING', description: 'Identifier of the evidence or file.' },
                content: { type: 'STRING', description: 'Raw content of the file or statement.' }
            },
            required: ['evidenceId', 'content']
        }
    },
    {
        name: 'foundry_synthesize_hypotheses',
        description: 'Synthesize format hypothesis ledger for an inspected statement file.',
        parameters: {
            type: 'OBJECT',
            properties: {
                evidenceId: { type: 'STRING', description: 'Identifier of the evidence item.' },
                content: { type: 'STRING', description: 'Raw file content.' },
                formatName: { type: 'STRING', description: 'Optional format family name override.' }
            },
            required: ['evidenceId', 'content']
        }
    },
    {
        name: 'foundry_parse_and_validate',
        description: 'Parse raw statement content through an adapter candidate and validate against business graph schema.',
        parameters: {
            type: 'OBJECT',
            properties: {
                content: { type: 'STRING', description: 'Raw statement content.' },
                adapterCode: { type: 'STRING', description: 'JavaScript code of the statement adapter.' }
            },
            required: ['content', 'adapterCode']
        }
    },
    {
        name: 'foundry_normalize_to_graph',
        description: 'Normalize parsed rows into canonical Artist Business Graph (ABG) schema.',
        parameters: {
            type: 'OBJECT',
            properties: {
                rawRows: { type: 'ARRAY', description: 'Array of parsed row records.' },
                formatFamily: { type: 'STRING', description: 'The detected distributor format family.' }
            },
            required: ['rawRows', 'formatFamily']
        }
    },
    {
        name: 'prepare_print_file',
        description: 'Prepare album artwork or merchandise graphics for high-resolution physical printing or DSP submission with exact bleed, DPI, and dimensions.',
        parameters: {
            type: 'OBJECT',
            properties: {
                imageUri: { type: 'STRING', description: 'Cloud Storage URI or asset path of source artwork.' },
                presetId: { type: 'STRING', description: 'Print target preset (e.g. streaming_3000, vinyl_sleeve, poster_18x24, poster_24x36, cover_art_distributor).' },
                bleedMode: { type: 'STRING', enum: ['fill', 'extend'], description: 'Bleed mode: fill (crops border for bleed) or extend (mirrors edges outward).' },
                focusX: { type: 'NUMBER', description: 'Normalized focal crop center X (0.0 to 1.0, default 0.5).' },
                focusY: { type: 'NUMBER', description: 'Normalized focal crop center Y (0.0 to 1.0, default 0.5).' },
                generateGuide: { type: 'BOOLEAN', description: 'Whether to produce a preview image with trim and safe-zone lines.' }
            },
            required: ['imageUri', 'presetId']
        }
    },
    {
        name: 'get_print_job_status',
        description: 'Check the status, progress, and download output URIs of a print preparation job.',
        parameters: {
            type: 'OBJECT',
            properties: {
                jobId: { type: 'STRING', description: 'The print job ID returned by prepare_print_file.' }
            },
            required: ['jobId']
        }
    },
    ...ARTIFACT_TOOL_DECLARATIONS as unknown as FunctionDeclaration[]
];
