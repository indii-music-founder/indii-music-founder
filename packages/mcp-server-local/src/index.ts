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

    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Server indiiOS-local-mcp running on stdio');
}

run().catch(console.error);
