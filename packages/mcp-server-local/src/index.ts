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

// Load env variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// Configure fluent-ffmpeg to use static ffprobe
ffmpeg.setFfprobePath(ffprobeStatic.path);

const server = new Server(
    {
        name: 'indiiOS-local-mcp',
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
        ],
    };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
            // Minimal placeholder logic for PDF reading if actual pdf-parse isn't fully integrated yet
            // To ensure 100% stable execution immediately without massive dependencies
            return {
                content: [
                    {
                        type: 'text',
                        text: `[PDF Parsing Placeholder] Read file at ${filePath}`,
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
                    'User-Agent': 'indiiOS-MCP'
                }
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
                    'User-Agent': 'indiiOS-MCP'
                }
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
                }
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

    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Server indiiOS-local-mcp running on stdio');
}

run().catch(console.error);
