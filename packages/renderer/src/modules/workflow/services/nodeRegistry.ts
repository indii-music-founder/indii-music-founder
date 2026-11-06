// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
import {
    Paintbrush,
    Video,
    Megaphone,
    Users,
    Box,
    Search,
    Cog,
    Database,
    FileText,
    Music,
    Scale,
    Send,
    ShieldCheck,
    Layers,
    type LucideIcon
} from 'lucide-react';
import type { DataType } from '../types';

export type { DataType };

export const DATA_TYPE_COLORS: Record<DataType, string> = {
    TRIGGER: '#e5e7eb', // gray-200
    TEXT: '#94a3b8',    // slate-400
    IMAGE: '#2dd4bf',   // teal-400
    VIDEO: '#c084fc',   // purple-400
    AUDIO: '#fbbf24',   // amber-400
    CONTEXT: '#38bdf8', // sky-400
    NOTE: '#34d399',    // emerald-400
    METADATA: '#60a5fa',// blue-400
    SPLITS: '#a78bfa',  // violet-400
    RELEASE_PACKAGE: '#f43f5e', // rose-500
    AUDIO_QC: '#f59e0b',// amber-500
    SUBGRAPH: '#ec4899',// pink-500
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
    icon: LucideIcon;
    jobs: NodeJob[];
}

// Static starter department configs for the workflow builder.
const departmentConfigs = [
    { name: 'Art Department', templates: [{ title: 'Concept Art', description: 'Generate concept art', prompt: 'Concept art of...' }] },
    { name: 'Marketing Department', templates: [{ title: 'Ad Copy', description: 'Write ad copy', prompt: 'Write ad copy for...' }] },
    { name: 'Social Media Department', templates: [{ title: 'Tweet', description: 'Write a tweet', prompt: 'Write a tweet about...' }] },
    { name: 'Campaign Manager', templates: [{ title: 'Campaign Strategy', description: 'Plan a campaign', prompt: 'Plan a campaign for...' }] },
];

// Helper to map existing templates to jobs with assumed types
const mapTemplatesToJobs = (deptName: string, defaultOutputType: DataType = 'TEXT'): NodeJob[] => {
    const config = departmentConfigs.find(d => d.name === deptName);
    const templates = config?.templates || [];
    const jobs: NodeJob[] = templates.map((t: { title: string; description: string; prompt: string }, i: number) => ({
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
    // ── Micro-Workflows / Subgraphs (Modular Sub-flows) ──
    'Micro-Workflows': {
        departmentName: 'Micro-Workflows',
        label: 'Micro-Flows (Subgraphs)',
        icon: Layers,
        jobs: [
            {
                id: 'micro-art-suite',
                label: 'Visuals & Canvas Micro-Flow',
                description: 'Encapsulated sub-workflow: generates 3000x3000px cover art, 4K upscale, and 9:16 vertical canvas loop.',
                defaultPrompt: 'Visual identity and looping canvas for single',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'concept_input', label: 'Concept / Lyrics', type: 'TEXT' }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'image_output', label: 'Cover Art', type: 'IMAGE' },
                    { id: 'video_output', label: 'Canvas Video', type: 'VIDEO' }
                ]
            },
            {
                id: 'micro-audio-qc',
                label: 'Mastering & Audio QC Micro-Flow',
                description: 'Encapsulated sub-workflow: audits loudness (-14 LUFS), true-peak limiting, and sonic fingerprint.',
                defaultPrompt: 'Audio master streaming audit',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'audio_input', label: 'Master Audio', type: 'AUDIO', required: true }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'qc_report', label: 'QC Report', type: 'AUDIO_QC' }
                ]
            },
            {
                id: 'micro-rights-metadata',
                label: 'Rights & Metadata Micro-Flow',
                description: 'Encapsulated sub-workflow: generates DDEX metadata, assigns ISRC/UPC barcodes, and compiles split sheet.',
                defaultPrompt: 'Release rights and metadata package',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'track_info', label: 'Track Info / Splits', type: 'TEXT', required: true }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'metadata_output', label: 'Metadata with ISRC/UPC', type: 'METADATA' },
                    { id: 'splits_output', label: '100% Split Sheet', type: 'SPLITS' }
                ]
            },
            {
                id: 'micro-social-hype',
                label: 'Social Hype & Pitch Micro-Flow',
                description: 'Encapsulated sub-workflow: drafts curator editorial pitch, TikTok/Reels captions, and launch countdown.',
                defaultPrompt: 'Social release rollout playbook',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'concept_input', label: 'Story & Hooks', type: 'TEXT', required: true }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'pitch_copy', label: 'DSP Pitch', type: 'TEXT' },
                    { id: 'social_copy', label: 'Social Copy', type: 'TEXT' }
                ]
            }
        ]
    },

    // ── Notes Department (Music Inception, Lyrics, Release Journal) ──
    'Notes Department': {
        departmentName: 'Notes Department',
        label: 'Notes & Songwriting',
        icon: FileText,
        jobs: [
            {
                id: 'note-input',
                label: 'Ingest Note / Lyrics',
                description: 'Pull lyrics, voice-memo transcription, or creative concept from the Notes system.',
                defaultPrompt: 'My latest songwriting note',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'query_input', label: 'Search / Note ID', type: 'TEXT' }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'note_output', label: 'Note Data', type: 'NOTE' },
                    { id: 'lyrics_output', label: 'Lyrics / Text', type: 'TEXT' }
                ]
            },
            {
                id: 'lyrics-extract',
                label: 'Extract Song Structure & Hooks',
                description: 'Parse lyrics from a note into structured verses, chorus, bridge, and key promo hooks.',
                defaultPrompt: 'Extract verse, chorus, bridge, and marketing punchlines from these lyrics.',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'lyrics_input', label: 'Raw Lyrics', type: 'TEXT', required: true }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'structured_lyrics', label: 'Structured Song', type: 'TEXT' },
                    { id: 'promo_hook', label: 'Primary Hook', type: 'TEXT' }
                ]
            },
            {
                id: 'note-save',
                label: 'Save Release Recipe to Notes',
                description: 'Save generated creative assets, metadata, splits, and rollout copy into a persistent user Note.',
                defaultPrompt: 'Complete Single Release Recipe',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'content_input', label: 'Recipe / Asset Data', type: 'ANY', required: true },
                    { id: 'title_input', label: 'Note Title', type: 'TEXT' }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'saved_note', label: 'Saved Note', type: 'NOTE' }
                ]
            }
        ]
    },

    // ── Music & Mastering Department ──
    'Music Department': {
        departmentName: 'Music Department',
        label: 'Mastering & Metadata',
        icon: Music,
        jobs: [
            {
                id: 'music-audio-qc',
                label: 'Audio Mastering QC',
                description: 'Verify audio meets DSP delivery specs: -14 LUFS integrated loudness, -1.0 dBFS true peak, and zero clipping.',
                defaultPrompt: 'Audit audio master for streaming compliance',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'audio_input', label: 'Master Audio', type: 'AUDIO', required: true }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'qc_report', label: 'QC Report', type: 'AUDIO_QC' },
                    { id: 'qc_passed', label: 'QC Passed', type: 'TRIGGER' }
                ]
            },
            {
                id: 'music-metadata',
                label: 'Generate Release Metadata',
                description: 'Format canonical release metadata (Title, Artist, Genre, Explicit flag, P-Line, C-Line).',
                defaultPrompt: 'Generate streaming release metadata package',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'track_info', label: 'Track Info / Notes', type: 'TEXT', required: true }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'metadata_output', label: 'Release Metadata', type: 'METADATA' }
                ]
            },
            {
                id: 'music-isrc-assign',
                label: 'Assign / Validate ISRC',
                description: 'Generate or validate the International Standard Recording Code for track masters.',
                defaultPrompt: 'Assign ISRC code',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'metadata_input', label: 'Metadata', type: 'METADATA', required: true }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'metadata_with_isrc', label: 'Metadata with ISRC', type: 'METADATA' }
                ]
            },
            {
                id: 'music-upc-assign',
                label: 'Assign / Validate UPC Barcode',
                description: 'Generate or validate the UPC/EAN release barcode for distribution.',
                defaultPrompt: 'Assign UPC barcode',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'metadata_input', label: 'Metadata', type: 'METADATA', required: true }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'metadata_with_upc', label: 'Metadata with UPC', type: 'METADATA' }
                ]
            }
        ]
    },

    // ── Splits & Rights Department ──
    'Splits & Rights Department': {
        departmentName: 'Splits & Rights Department',
        label: 'Splits & Publishing',
        icon: Scale,
        jobs: [
            {
                id: 'splits-compiler',
                label: 'Compile Split Sheet',
                description: 'Calculate and enforce 100% total verification for Master & Publishing rights with PRO registration.',
                defaultPrompt: 'Compile balanced split sheet for collaborators',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'collaborators_input', label: 'Collaborator Splits', type: 'ANY', required: true }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'splits_output', label: 'Verified Split Sheet', type: 'SPLITS' }
                ]
            }
        ]
    },

    // ── Distribution & Release Department ──
    'Distribution & Release Department': {
        departmentName: 'Distribution & Release Department',
        label: 'Distribution Pre-Flight',
        icon: ShieldCheck,
        jobs: [
            {
                id: 'ddex-preflight',
                label: 'DSP Pre-Flight Validator',
                description: 'Validate complete delivery bundle: audio QC, cover art dimensions, metadata, ISRC, and 100% splits.',
                defaultPrompt: 'Perform full DDEX release pre-flight inspection',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'metadata_input', label: 'Metadata', type: 'METADATA', required: true },
                    { id: 'cover_art_input', label: 'Cover Art', type: 'IMAGE', required: true },
                    { id: 'qc_input', label: 'Audio QC', type: 'AUDIO_QC' },
                    { id: 'splits_input', label: 'Split Sheet', type: 'SPLITS' }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'package_output', label: 'Release Package', type: 'RELEASE_PACKAGE' },
                    { id: 'ready_trigger', label: 'Ready for DSP', type: 'TRIGGER' }
                ]
            }
        ]
    },

    // ── Art Department ──
    'Art Department': {
        departmentName: 'Art Department',
        label: 'Art Department',
        icon: Paintbrush,
        jobs: [
            ...mapTemplatesToJobs('Art Department', 'IMAGE'),
            {
                id: 'art-cover-art',
                label: 'Single / Album Cover Art',
                description: 'Generate 3000x3000px square cover art tailored to the song mood and title.',
                defaultPrompt: 'High quality music album cover art, 3000x3000px square, cinematic lighting, vivid colors.',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'concept_input', label: 'Visual Concept / Mood', type: 'TEXT' }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'image_output', label: 'Cover Art', type: 'IMAGE' }
                ]
            },
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

    // ── Video Department ──
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
                defaultPrompt: 'Continue the action.',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'video_input', label: 'Input Video', type: 'VIDEO', required: true },
                    { id: 'text_input', label: 'Prompt', type: 'TEXT' }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'video_output', label: 'Extended Video', type: 'VIDEO' }
                ]
            },
            {
                id: 'video-analyze-song',
                label: 'Analyze Song',
                description: 'Extract audio metadata: BPM, mood, structure, and timestamps.',
                defaultPrompt: 'Analyze this audio file',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'audio_input', label: 'Verified Master', type: 'AUDIO', required: true }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'context_output', label: 'Audio Metadata', type: 'CONTEXT' }
                ]
            },
            {
                id: 'video-canvas',
                label: 'Spotify Canvas / TikTok (9:16)',
                description: 'Generate vertical 9:16 looping video visualizer synced with the song mood.',
                defaultPrompt: 'Seamless vertical 9:16 looping visualizer, hypnotic motion, aesthetic lighting.',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'image_input', label: 'Cover / Artist Art', type: 'IMAGE' },
                    { id: 'text_input', label: 'Visual Style', type: 'TEXT' }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'video_output', label: 'Canvas Video', type: 'VIDEO' }
                ]
            },
            {
                id: 'video-performance-clip',
                label: 'Performance Clip (Img2Vid)',
                description: 'Generate a performance video clip from an artist image. Optimized for beat-synced assembly.',
                defaultPrompt: 'Artist performing with dynamic cinematic camera movement.',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'image_input', label: 'Artist Image', type: 'IMAGE', required: true },
                    { id: 'text_input', label: 'Scene Prompt', type: 'TEXT' },
                    { id: 'duration_input', label: 'Duration (sec)', type: 'TEXT' }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'video_output', label: 'Performance Video', type: 'VIDEO' }
                ]
            },
            {
                id: 'video-beat-sync-assemble',
                label: 'Beat-Sync Assemble',
                description: 'Assemble performance video clips with the original song. Clips are beat-aligned based on BPM.',
                defaultPrompt: 'Assemble performance video',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'audio_input', label: 'Verified Master', type: 'AUDIO', required: true },
                    { id: 'image_input', label: 'Artist Image URL', type: 'IMAGE', required: true },
                    { id: 'text_input', label: 'Performance Style', type: 'TEXT' }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'video_output', label: 'Final Video', type: 'VIDEO' }
                ]
            }
        ]
    },

    // ── Marketing Department ──
    'Marketing Department': {
        departmentName: 'Marketing Department',
        label: 'Marketing Dept',
        icon: Megaphone,
        jobs: [
            ...mapTemplatesToJobs('Marketing Department', 'TEXT'),
            {
                id: 'marketing-dsp-pitch',
                label: 'DSP Playlist Pitch',
                description: 'Write an editorial pitch note for Spotify for Artists, Apple Music, and Amazon Music curators.',
                defaultPrompt: 'Write a compelling editorial pitch describing the sound, mood, instrumentation, and marketing plan for DSP curators.',
                inputs: [
                    { id: 'trigger', label: 'Start', type: 'TRIGGER' },
                    { id: 'metadata_input', label: 'Track Metadata', type: 'METADATA' },
                    { id: 'concept_input', label: 'Story & Lyrics', type: 'TEXT' }
                ],
                outputs: [
                    { id: 'trigger_out', label: 'Done', type: 'TRIGGER' },
                    { id: 'pitch_copy', label: 'Editorial Pitch', type: 'TEXT' }
                ]
            }
        ]
    },

    // ── Social Media Department ──
    'Social Media Department': {
        departmentName: 'Social Media Department',
        label: 'Social Media Dept',
        icon: Users,
        jobs: mapTemplatesToJobs('Social Media Department', 'TEXT')
    },

    // ── Campaign Manager ──
    'Campaign Manager': {
        departmentName: 'Campaign Manager',
        label: 'Campaign Manager',
        icon: Box,
        jobs: mapTemplatesToJobs('Campaign Manager', 'TEXT')
    },

    // ── Knowledge Base ──
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
    if (departmentName === 'Logic') return LOGIC_REGISTRY['Logic'] ?? null;
    if (departmentName === 'Variables') return LOGIC_REGISTRY['Variables'] ?? null;
    return NODE_REGISTRY[departmentName] || null;
};

export const getJobDefinition = (departmentName: string, jobId?: string): NodeJob | null => {
    const def = getNodeDefinition(departmentName);
    if (!def) return null;
    return def.jobs.find(j => j.id === jobId) ?? def.jobs[0] ?? null;
};
