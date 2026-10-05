import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from '@modelcontextprotocol/sdk/types.js';
import ffmpeg from 'fluent-ffmpeg';
import ffprobeStatic from 'ffprobe-static';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { extractPdfContractText } from './pdf.js';
import { getBlenderStatus } from './blender/discovery.js';
import { listAvailableTemplates } from './blender/templates.js';
import { executeBlenderRender } from './blender/executor.js';
import { sendLiveBlenderCommand, checkLiveBlenderConnected } from './blender/liveBridge.js';
import type {
    BlenderRenderOptions,
    BlenderTemplateId,
    BlenderResolution,
    BlenderAspectRatio,
    BlenderRenderEngine,
    BlenderVisualTokens,
} from './blender/types.js';

// Load env variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// Configure fluent-ffmpeg to use static ffprobe
ffmpeg.setFfprobePath(ffprobeStatic.path);

const server = new Server(
    {
        name: 'indii-local-mcp',
        version: '0.1.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'read_wav_tags',
                description: 'Extracts metadata tags from a local .wav or .mp3 file.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Absolute path to the audio file',
                        },
                    },
                    required: ['filePath'],
                },
            },
            {
                name: 'read_pdf_contracts',
                description: 'Reads text from a local PDF contract file.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Absolute path to the PDF file',
                        },
                    },
                    required: ['filePath'],
                },
            },
            {
                name: 'get_github_pr_comments',
                description: 'Fetches PR comments from GitHub, typically to read CodeRabbit reviews.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        owner: { type: 'string', description: 'GitHub repository owner' },
                        repo: { type: 'string', description: 'GitHub repository name' },
                        pull_number: { type: 'number', description: 'PR number' }
                    },
                    required: ['owner', 'repo', 'pull_number'],
                },
            },
            {
                name: 'get_sentry_issues',
                description: 'Fetches unresolved issues from a Sentry project.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        organization_slug: { type: 'string', description: 'Sentry organization slug' },
                        project_slug: { type: 'string', description: 'Sentry project slug' }
                    },
                    required: ['organization_slug', 'project_slug'],
                },
            },
            {
                name: 'blender_get_status',
                description: 'Checks Blender installation, CLI path, version, GPU acceleration (Metal/CUDA/CPU), and live addon connection.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
            {
                name: 'blender_list_templates',
                description: 'Lists all 5 available procedural 3D music video templates (Audio Tunnel, Vinyl Turntable, Chrome Text, Spectrum Bars, Concert Stage).',
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
            },
            {
                name: 'blender_render_music_video',
                description: 'Renders an audio-reactive 3D music video or visualizer headlessly using Blender.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        audioFilePath: { type: 'string', description: 'Absolute path to song master audio file (.wav/.mp3)' },
                        outputVideoPath: { type: 'string', description: 'Destination path for rendered MP4 video' },
                        templateId: {
                            type: 'string',
                            enum: ['audio_reactive_tunnel', 'vinyl_turntable', 'chrome_text', 'spectrum_bars', 'concert_stage'],
                            description: 'Procedural template to render'
                        },
                        bpm: { type: 'number', description: 'Track tempo in BPM for beat synchronization' },
                        durationSeconds: { type: 'number', description: 'Duration of video in seconds (default 30)' },
                        fps: { type: 'number', description: 'Framerate (default 30)' },
                        resolution: { type: 'string', enum: ['720p', '1080p', '4k'], description: 'Resolution (default 1080p)' },
                        aspectRatio: { type: 'string', enum: ['16:9', '9:16', '1:1'], description: 'Aspect ratio (16:9 widescreen, 9:16 vertical, 1:1 square)' },
                        engine: { type: 'string', enum: ['BLENDER_EEVEE_NEXT', 'CYCLES'], description: 'Render engine' },
                        visualTokens: {
                            type: 'object',
                            properties: {
                                primaryColor: { type: 'string', description: 'Hex primary color e.g. #00F0FF' },
                                secondaryColor: { type: 'string', description: 'Hex secondary color e.g. #FF0055' },
                                artistName: { type: 'string', description: 'Artist name for 3D typography' },
                                trackTitle: { type: 'string', description: 'Track title for 3D typography' },
                                coverArtPath: { type: 'string', description: 'Path to album cover art image' }
                            }
                        }
                    },
                    required: ['audioFilePath', 'outputVideoPath', 'templateId'],
                },
            },
            {
                name: 'blender_live_command',
                description: 'Sends a command to the active interactive Blender session via the indii 3D Bridge addon.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        action: { type: 'string', enum: ['ping', 'get_scene_info', 'exec_code'], description: 'Action to execute' },
                        params: { type: 'object', description: 'Action parameters (e.g. code: string)' }
                    },
                    required: ['action'],
                },
            },
        ],
    };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;

    if (name === 'read_wav_tags') {
        const filePath = String(args?.filePath);
        if (!filePath || !fs.existsSync(filePath)) {
            throw new McpError(ErrorCode.InvalidParams, `File not found: ${filePath}`);
        }

        try {
            const metadata = await new Promise((resolve, reject) => {
                ffmpeg.ffprobe(filePath, (err, metadata) => {
                    if (err) reject(err);
                    else resolve(metadata);
                });
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(metadata, null, 2),
                    },
                ],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error reading tags: ${errorMessage}`,
                    },
                ],
                isError: true,
            };
        }
    }

    if (name === 'read_pdf_contracts') {
        const filePath = String(args?.filePath);
        if (!filePath || !fs.existsSync(filePath)) {
            throw new McpError(ErrorCode.InvalidParams, `File not found: ${filePath}`);
        }

        try {
            const pdfExtraction = await extractPdfContractText(filePath);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            filePath: pdfExtraction.filePath,
                            pageCount: pdfExtraction.pageCount,
                            hasSelectableText: pdfExtraction.hasSelectableText,
                            text: pdfExtraction.text,
                        }, null, 2),
                    },
                ],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error reading pdf: ${errorMessage}`,
                    },
                ],
                isError: true,
            };
        }
    }

    if (name === 'get_github_pr_comments') {
        const owner = String(args?.owner);
        const repo = String(args?.repo);
        const pull_number = Number(args?.pull_number);
        const token = process.env.GITHUB_TOKEN;

        if (!token) {
            return {
                content: [{ type: 'text', text: 'Error: GITHUB_TOKEN not found in environment' }],
                isError: true,
            };
        }

        try {
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}/reviews`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'indii-MCP'
                },
                signal: AbortSignal.timeout(15_000),
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }

            const reviews = await response.json();
            
            // Also fetch review comments (line-specific)
            const commentsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}/comments`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'indii-MCP'
                },
                signal: AbortSignal.timeout(15_000),
            });
            const comments = commentsResponse.ok ? await commentsResponse.json() : [];

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ reviews, comments }, null, 2),
                    },
                ],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: 'text', text: `Error fetching GitHub PR comments: ${errorMessage}` }],
                isError: true,
            };
        }
    }

    if (name === 'get_sentry_issues') {
        const org = String(args?.organization_slug);
        const project = String(args?.project_slug);
        const token = process.env.SENTRY_TOKEN;

        if (!token) {
            return {
                content: [{ type: 'text', text: 'Error: SENTRY_TOKEN not found in environment' }],
                isError: true,
            };
        }

        try {
            const response = await fetch(`https://sentry.io/api/0/projects/${org}/${project}/issues/?query=is:unresolved`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(15_000),
            });

            if (!response.ok) {
                throw new Error(`Sentry API error: ${response.status} ${response.statusText}`);
            }

            const issues = await response.json();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(issues, null, 2),
                    },
                ],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: 'text', text: `Error fetching Sentry issues: ${errorMessage}` }],
                isError: true,
            };
        }
    }

    if (name === 'blender_get_status') {
        try {
            const isLive = await checkLiveBlenderConnected();
            const status = await getBlenderStatus(isLive);
            return {
                content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: 'text', text: `Error checking Blender status: ${errorMessage}` }],
                isError: true,
            };
        }
    }

    if (name === 'blender_list_templates') {
        try {
            const templates = listAvailableTemplates();
            return {
                content: [{ type: 'text', text: JSON.stringify(templates, null, 2) }],
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: 'text', text: `Error listing templates: ${errorMessage}` }],
                isError: true,
            };
        }
    }

    if (name === 'blender_render_music_video') {
        try {
            const renderOptions: BlenderRenderOptions = {
                audioFilePath: String(args?.audioFilePath),
                outputVideoPath: String(args?.outputVideoPath),
                templateId: (args?.templateId as BlenderTemplateId) ?? 'audio_reactive_tunnel',
                bpm: args?.bpm ? Number(args.bpm) : undefined,
                durationSeconds: args?.durationSeconds ? Number(args.durationSeconds) : 30,
                fps: args?.fps ? Number(args.fps) : 30,
                resolution: (args?.resolution as BlenderResolution) ?? '1080p',
                aspectRatio: (args?.aspectRatio as BlenderAspectRatio) ?? '16:9',
                engine: (args?.engine as BlenderRenderEngine) ?? 'BLENDER_EEVEE_NEXT',
                visualTokens: args?.visualTokens as BlenderVisualTokens | undefined
            };

            const token = request.params._meta?.progressToken;
            const result = await executeBlenderRender(renderOptions, progress => {
                if (token !== undefined) {
                    void extra.sendNotification({ method: 'notifications/progress', params: {
                        progressToken: token, progress: progress.percentage, total: 100,
                        message: progress.message || progress.status,
                    }}).catch(() => { /* Caller disconnected; signal handles process cancellation. */ });
                }
            }, extra.signal);
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                isError: !result.success
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: 'text', text: `Blender render failed: ${errorMessage}` }],
                isError: true,
            };
        }
    }

    if (name === 'blender_live_command') {
        try {
            const action = String(args?.action);
            const params = (args?.params as Record<string, unknown>) ?? {};
            const result = await sendLiveBlenderCommand(action, params);
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                isError: result.status === 'error'
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: 'text', text: `Blender live command failed: ${errorMessage}` }],
                isError: true,
            };
        }
    }

    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Server indii-local-mcp running on stdio');
}

run().catch(console.error);
