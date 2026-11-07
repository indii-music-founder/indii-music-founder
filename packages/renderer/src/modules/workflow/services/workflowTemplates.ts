// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { v4 as uuidv4 } from 'uuid';
import { SavedWorkflow, Status } from '../types';

export const WORKFLOW_TEMPLATES: SavedWorkflow[] = [
    {
        id: 'template-full-music-release',
        name: 'Complete Music Release & Notes Suite',
        description: 'End-to-end music release engine: pulls song concept and lyrics from Notes, verifies audio QC, assigns ISRC/UPC, compiles splits, creates 3000x3000px cover art and 9:16 vertical canvas video, drafts DSP playlist pitch, verifies DDEX preflight, and saves the complete release recipe back into Notes.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        viewport: { x: 0, y: 0, zoom: 0.75 },
        nodes: [
            {
                id: 'start',
                type: 'inputNode',
                position: { x: 0, y: 300 },
                data: {
                    nodeType: 'input',
                    prompt: 'New indie electronic single "Neon Drift"',
                    status: Status.PENDING
                }
            },
            {
                id: 'notes-in',
                type: 'departmentNode',
                position: { x: 280, y: 150 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Notes Department',
                    selectedJobId: 'note-input',
                    prompt: 'Neon Drift lyrics and songwriting notes',
                    status: Status.PENDING
                }
            },
            {
                id: 'lyrics-ext',
                type: 'departmentNode',
                position: { x: 560, y: 150 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Notes Department',
                    selectedJobId: 'lyrics-extract',
                    prompt: 'Extract hook and structured sections',
                    status: Status.PENDING
                }
            },
            {
                id: 'music-qc',
                type: 'departmentNode',
                position: { x: 280, y: 450 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Music Department',
                    selectedJobId: 'music-audio-qc',
                    prompt: 'Mastering audio QC check',
                    status: Status.PENDING
                }
            },
            {
                id: 'metadata-gen',
                type: 'departmentNode',
                position: { x: 560, y: 450 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Music Department',
                    selectedJobId: 'music-metadata',
                    prompt: 'Neon Drift release metadata',
                    status: Status.PENDING
                }
            },
            {
                id: 'isrc-assign',
                type: 'departmentNode',
                position: { x: 840, y: 450 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Music Department',
                    selectedJobId: 'music-isrc-assign',
                    prompt: 'Assign ISRC',
                    status: Status.PENDING
                }
            },
            {
                id: 'splits-gen',
                type: 'departmentNode',
                position: { x: 840, y: 250 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Splits & Rights Department',
                    selectedJobId: 'splits-compiler',
                    prompt: 'Compile 100% balanced split sheet',
                    status: Status.PENDING
                }
            },
            {
                id: 'art-gen',
                type: 'departmentNode',
                position: { x: 1120, y: 150 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Art Department',
                    selectedJobId: 'art-cover-art',
                    prompt: '3000x3000px square cover art for Neon Drift, moody night highway, aesthetic reflections',
                    status: Status.PENDING
                }
            },
            {
                id: 'video-canvas',
                type: 'departmentNode',
                position: { x: 1400, y: 150 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Video Department',
                    selectedJobId: 'video-canvas',
                    prompt: '9:16 vertical looping canvas visualizer for Spotify and TikTok',
                    status: Status.PENDING
                }
            },
            {
                id: 'dsp-pitch',
                type: 'departmentNode',
                position: { x: 1120, y: 380 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Marketing Department',
                    selectedJobId: 'marketing-dsp-pitch',
                    prompt: 'DSP playlist curator editorial pitch for Neon Drift',
                    status: Status.PENDING
                }
            },
            {
                id: 'preflight-check',
                type: 'departmentNode',
                position: { x: 1400, y: 380 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Distribution & Release Department',
                    selectedJobId: 'ddex-preflight',
                    prompt: 'Verify DDEX delivery package',
                    status: Status.PENDING
                }
            },
            {
                id: 'gatekeeper',
                type: 'logicNode',
                position: { x: 1680, y: 280 },
                data: {
                    nodeType: 'logic',
                    jobId: 'gatekeeper',
                    label: 'Human Approval Checkpoint',
                    status: Status.PENDING,
                    config: {
                        message: 'Approve complete release package before saving recipe to Notes and distribution queue.'
                    }
                }
            },
            {
                id: 'notes-save',
                type: 'departmentNode',
                position: { x: 1960, y: 280 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Notes Department',
                    selectedJobId: 'note-save',
                    prompt: 'Save completed release package recipe',
                    status: Status.PENDING
                }
            },
            {
                id: 'end',
                type: 'outputNode',
                position: { x: 2240, y: 280 },
                data: {
                    nodeType: 'output',
                    status: Status.PENDING
                }
            }
        ],
        edges: [
            { id: 'e1', source: 'start', target: 'notes-in', sourceHandle: 'trigger', targetHandle: 'trigger' },
            { id: 'e2', source: 'start', target: 'music-qc', sourceHandle: 'trigger', targetHandle: 'trigger' },
            { id: 'e3', source: 'notes-in', target: 'lyrics-ext', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e4', source: 'lyrics-ext', target: 'metadata-gen', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e5', source: 'music-qc', target: 'metadata-gen', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e6', source: 'metadata-gen', target: 'isrc-assign', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e7', source: 'metadata-gen', target: 'splits-gen', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e8', source: 'lyrics-ext', target: 'art-gen', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e9', source: 'art-gen', target: 'video-canvas', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e10', source: 'isrc-assign', target: 'dsp-pitch', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e11', source: 'isrc-assign', target: 'preflight-check', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e12', source: 'splits-gen', target: 'preflight-check', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e13', source: 'art-gen', target: 'preflight-check', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e14', source: 'preflight-check', target: 'gatekeeper', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e15', source: 'video-canvas', target: 'gatekeeper', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e16', source: 'gatekeeper', target: 'notes-save', sourceHandle: 'approve', targetHandle: 'trigger' },
            { id: 'e17', source: 'notes-save', target: 'end', sourceHandle: 'trigger_out', targetHandle: 'trigger' }
        ]
    },
    {
        id: 'template-simple-image',
        name: 'Simple Concept Art',
        description: 'Generate a concept art image from a text prompt.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
            {
                id: 'start',
                type: 'inputNode',
                position: { x: 100, y: 200 },
                data: {
                    nodeType: 'input',
                    prompt: 'Create original single-release cover artwork with an analog editorial feel, tactile print texture, a clear focal subject, and thoughtful negative space. Ask for the artist name, release title, mood, and visual references before generating. Avoid generated lettering.',
                    status: Status.PENDING
                }
            },
            {
                id: 'art-1',
                type: 'departmentNode',
                position: { x: 400, y: 200 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Art Department',
                    selectedJobId: 'art-department-job-0',
                    status: Status.PENDING
                }
            },
            {
                id: 'end',
                type: 'outputNode',
                position: { x: 700, y: 200 },
                data: {
                    nodeType: 'output',
                    status: Status.PENDING
                }
            }
        ],
        edges: [
            { id: 'e1', source: 'start', target: 'art-1', sourceHandle: 'trigger', targetHandle: 'trigger' },
            { id: 'e2', source: 'art-1', target: 'end', sourceHandle: 'trigger_out', targetHandle: 'trigger' }
        ]
    },
    {
        id: 'template-video-teaser',
        name: 'Video Teaser Campaign',
        description: 'Create concept art, animate it, and write a tweet.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
            {
                id: 'start',
                type: 'inputNode',
                position: { x: 50, y: 250 },
                data: {
                    nodeType: 'input',
                    prompt: 'Create a short vertical music teaser for the artist’s finished track using their uploaded artwork or footage. Ask for the track, preferred moment, and visual direction before generating. Keep the source artwork recognizable and leave clean space for optional release text.',
                    status: Status.PENDING
                }
            },
            {
                id: 'art-1',
                type: 'departmentNode',
                position: { x: 350, y: 250 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Art Department',
                    selectedJobId: 'art-department-job-0',
                    status: Status.PENDING
                }
            },
            {
                id: 'video-1',
                type: 'departmentNode',
                position: { x: 650, y: 250 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Video Department',
                    selectedJobId: 'video-img-to-video',
                    status: Status.PENDING
                }
            },
            {
                id: 'social-1',
                type: 'departmentNode',
                position: { x: 950, y: 250 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Social Media Department',
                    selectedJobId: 'social-media-department-job-0',
                    status: Status.PENDING
                }
            },
            {
                id: 'end',
                type: 'outputNode',
                position: { x: 1250, y: 250 },
                data: {
                    nodeType: 'output',
                    status: Status.PENDING
                }
            }
        ],
        edges: [
            { id: 'e1', source: 'start', target: 'art-1', sourceHandle: 'trigger', targetHandle: 'trigger' },
            { id: 'e2', source: 'art-1', target: 'video-1', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e3', source: 'video-1', target: 'social-1', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e4', source: 'social-1', target: 'end', sourceHandle: 'trigger_out', targetHandle: 'trigger' }
        ]
    },
    {
        id: 'template-music-release',
        name: 'Music Release Package',
        description: 'Generate album art and marketing copy for a new track.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
            {
                id: 'start',
                type: 'inputNode',
                position: { x: 50, y: 200 },
                data: {
                    nodeType: 'input',
                    prompt: 'New summer house track "Sunset Vibes"',
                    status: Status.PENDING
                }
            },
            {
                id: 'art-1',
                type: 'departmentNode',
                position: { x: 350, y: 100 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Art Department',
                    selectedJobId: 'art-department-job-0',
                    status: Status.PENDING
                }
            },
            {
                id: 'marketing-1',
                type: 'departmentNode',
                position: { x: 350, y: 300 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Marketing Department',
                    selectedJobId: 'marketing-department-job-0',
                    status: Status.PENDING
                }
            },
            {
                id: 'end',
                type: 'outputNode',
                position: { x: 700, y: 200 },
                data: {
                    nodeType: 'output',
                    status: Status.PENDING
                }
            }
        ],
        edges: [
            { id: 'e1', source: 'start', target: 'art-1', sourceHandle: 'trigger', targetHandle: 'trigger' },
            { id: 'e2', source: 'start', target: 'marketing-1', sourceHandle: 'trigger', targetHandle: 'trigger' },
            { id: 'e3', source: 'art-1', target: 'end', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e4', source: 'marketing-1', target: 'end', sourceHandle: 'trigger_out', targetHandle: 'trigger' }
        ]
    },
    {
        id: 'template-single-release-waterfall',
        name: 'Single Release Waterfall Playbook',
        description: 'Automated waterfall single campaign. Generates cover art, marketing copy, social posts, and routing checklist.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        viewport: { x: 0, y: 0, zoom: 0.85 },
        nodes: [
            {
                id: 'start',
                type: 'inputNode',
                position: { x: 50, y: 250 },
                data: {
                    nodeType: 'input',
                    prompt: 'New electronic single "Hyperdrive"',
                    status: Status.PENDING
                }
            },
            {
                id: 'art-1',
                type: 'departmentNode',
                position: { x: 300, y: 150 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Art Department',
                    selectedJobId: 'art-department-job-0',
                    status: Status.PENDING
                }
            },
            {
                id: 'marketing-1',
                type: 'departmentNode',
                position: { x: 300, y: 350 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Marketing Department',
                    selectedJobId: 'marketing-department-job-0',
                    status: Status.PENDING
                }
            },
            {
                id: 'social-1',
                type: 'departmentNode',
                position: { x: 550, y: 350 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Social Media Department',
                    selectedJobId: 'social-media-department-job-0',
                    status: Status.PENDING
                }
            },
            {
                id: 'end',
                type: 'outputNode',
                position: { x: 800, y: 250 },
                data: {
                    nodeType: 'output',
                    status: Status.PENDING
                }
            }
        ],
        edges: [
            { id: 'e1', source: 'start', target: 'art-1', sourceHandle: 'trigger', targetHandle: 'trigger' },
            { id: 'e2', source: 'start', target: 'marketing-1', sourceHandle: 'trigger', targetHandle: 'trigger' },
            { id: 'e3', source: 'marketing-1', target: 'social-1', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e4', source: 'art-1', target: 'end', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e5', source: 'social-1', target: 'end', sourceHandle: 'trigger_out', targetHandle: 'trigger' }
        ]
    },
    {
        id: 'template-regional-tour-booking',
        name: 'Regional Tour Booking Playbook',
        description: 'Automation for planning regional tours. Drafts pitch letters to venues, constructs routes, and designs flyers.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        viewport: { x: 0, y: 0, zoom: 0.8 },
        nodes: [
            {
                id: 'start',
                type: 'inputNode',
                position: { x: 50, y: 250 },
                data: {
                    nodeType: 'input',
                    prompt: 'Regional East Coast tour planning',
                    status: Status.PENDING
                }
            },
            {
                id: 'booking-1',
                type: 'departmentNode',
                position: { x: 300, y: 150 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Live & Booking Department',
                    selectedJobId: 'custom',
                    status: Status.PENDING
                }
            },
            {
                id: 'marketing-1',
                type: 'departmentNode',
                position: { x: 300, y: 350 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Marketing Department',
                    selectedJobId: 'marketing-department-job-0',
                    status: Status.PENDING
                }
            },
            {
                id: 'art-1',
                type: 'departmentNode',
                position: { x: 550, y: 350 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Art Department',
                    selectedJobId: 'art-department-job-0',
                    status: Status.PENDING
                }
            },
            {
                id: 'end',
                type: 'outputNode',
                position: { x: 800, y: 250 },
                data: {
                    nodeType: 'output',
                    status: Status.PENDING
                }
            }
        ],
        edges: [
            { id: 'e1', source: 'start', target: 'booking-1', sourceHandle: 'trigger', targetHandle: 'trigger' },
            { id: 'e2', source: 'start', target: 'marketing-1', sourceHandle: 'trigger', targetHandle: 'trigger' },
            { id: 'e3', source: 'marketing-1', target: 'art-1', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e4', source: 'booking-1', target: 'end', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e5', source: 'art-1', target: 'end', sourceHandle: 'trigger_out', targetHandle: 'trigger' }
        ]
    },
    {
        id: 'template-song-performance-video',
        name: 'Song → Performance Video',
        description: 'Create a beat-synced performance music video from an uploaded song and AI artist imagery.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        viewport: { x: 0, y: 0, zoom: 1 },
        nodes: [
            {
                id: 'start',
                type: 'inputNode',
                position: { x: 50, y: 250 },
                data: {
                    nodeType: 'input',
                    prompt: 'My latest single ready for a music video',
                    status: Status.PENDING
                }
            },
            {
                id: 'video-analyze',
                type: 'departmentNode',
                position: { x: 300, y: 250 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Video Department',
                    selectedJobId: 'video-analyze-song',
                    status: Status.PENDING
                }
            },
            {
                id: 'video-final',
                type: 'departmentNode',
                position: { x: 600, y: 250 },
                data: {
                    nodeType: 'department',
                    departmentName: 'Video Department',
                    selectedJobId: 'video-beat-sync-assemble',
                    status: Status.PENDING
                }
            },
            {
                id: 'end',
                type: 'outputNode',
                position: { x: 900, y: 250 },
                data: {
                    nodeType: 'output',
                    status: Status.PENDING
                }
            }
        ],
        edges: [
            { id: 'e1', source: 'start', target: 'video-analyze', sourceHandle: 'trigger', targetHandle: 'trigger' },
            { id: 'e2', source: 'video-analyze', target: 'video-final', sourceHandle: 'trigger_out', targetHandle: 'trigger' },
            { id: 'e3', source: 'video-final', target: 'end', sourceHandle: 'trigger_out', targetHandle: 'trigger' }
        ]
    }
];
