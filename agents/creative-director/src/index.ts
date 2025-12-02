
import { Agent } from '@mastra/core';
import { MCPClient } from '@mastra/mcp';
import { google } from '@ai-sdk/google';

import { imageTool } from './tools/imageTool';

const mcpClient = new MCPClient({
    id: 'docker-gateway-client',
    servers: {
        dockerGateway: {
            url: new URL(process.env.MCP_DOCKER_GATEWAY_URL || 'http://localhost:8080'),
        },
    },
});

export const creativeDirector = new Agent({
  name: 'Creative Director',
  instructions: `
    You are the Creative Director for the Rndr-AI platform.
    Your role is to oversee the creation of visual assets (images and videos).
    
    You have access to tools that can generate images and video treatments.
    When a user asks for a visual creation, you should:
    1. Analyze the request.
    2. Refine the prompt for artistic quality.
    3. Use the appropriate tool to generate the asset.
    4. Maintain brand consistency based on the user's Brand Kit.
  `,
  model: google('gemini-3-pro-preview'),
  mcpClient: mcpClient,
});
