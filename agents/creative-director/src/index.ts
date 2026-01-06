
import { Agent } from '@mastra/core';
import { MCPClient } from '@mastra/mcp';
import { google } from '@ai-sdk/google';
import { createTool } from '@mastra/core';
import { z } from 'zod';
import { DirectorTools } from '@/services/agent/tools/DirectorTools';

// Create Mastra-compatible tools that wrap the working DirectorTools

const generateImageTool = createTool({
  id: 'generate_image',
  description: 'Generate AI images using text prompts with support for aspect ratios, reference images, and brand guidelines. Images are automatically saved to history.',
  inputSchema: z.object({
    prompt: z.string().min(10).describe('Visual description of the image to generate'),
    aspectRatio: z.string().optional().describe('Aspect ratio: 1:1, 16:9, 9:16, 4:3, 3:4, 3:2'),
    count: z.number().min(1).max(4).optional().describe('Number of images (1-4)'),
    negativePrompt: z.string().optional().describe('Things to avoid in the image'),
    resolution: z.string().optional().describe('Resolution: 4K, 2K, HD'),
    seed: z.string().optional().describe('Random seed for reproducibility'),
    referenceImageIndex: z.number().optional().describe('Index of reference image from Brand Kit'),
    referenceAssetIndex: z.number().optional().describe('Index of brand asset (logo) from Brand Kit'),
    uploadedImageIndex: z.number().optional().describe('Index of recent upload to use as reference'),
  }),
  execute: async ({ context }) => {
    try {
      const result = await DirectorTools.generate_image(context);
      return {
        success: result.success,
        data: result.data,
        message: result.message
      };
    } catch (error: any) {
      console.error('[Mastra Agent] Image generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
});

const searchKnowledgeTool = createTool({
  id: 'search_knowledge',
  description: 'Search the project knowledge base for brand guidelines, style guides, policies, and other documentation',
  inputSchema: z.object({
    query: z.string().describe('Search query for the knowledge base')
  }),
  execute: async ({ context }) => {
    try {
      // Import knowledge tools from indiiOS system
      const { KnowledgeTools } = await import('@/services/agent/tools/KnowledgeTools');
      const result = await KnowledgeTools.search_knowledge(context);
      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      console.error('[Mastra Agent] Knowledge search failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
});

const batchEditImagesTool = createTool({
  id: 'batch_edit_images',
  description: 'Edit multiple uploaded images with a text instruction',
  inputSchema: z.object({
    prompt: z.string().describe('Text instruction for how to edit the images'),
    imageIndices: z.array(z.number()).optional().describe('Specific image indices to edit (edits all if not specified)')
  }),
  execute: async ({ context }) => {
    try {
      const result = await DirectorTools.batch_edit_images(context);
      return {
        success: result.success,
        data: result.data,
        message: result.message
      };
    } catch (error: any) {
      console.error('[Mastra Agent] Batch edit failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
});

const generateShowroomMockupTool = createTool({
  id: 'run_showroom_mockup',
  description: 'Generate photorealistic product mockups for showcases',
  inputSchema: z.object({
    productType: z.string().describe('Type of product (e.g., vinyl record, CD, t-shirt)'),
    scenePrompt: z.string().describe('Scene description, lighting, background')
  }),
  execute: async ({ context }) => {
    try {
      const result = await DirectorTools.run_showroom_mockup(context as any);
      return {
        success: result.success,
        data: result.data,
        message: result.message
      };
    } catch (error: any) {
      console.error('[Mastra Agent] Showroom mockup failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
});

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
    You are the Creative Director for the indiiOS platform.
    Your role is to oversee the creation of visual assets (images and videos) for independent artists.

    CRITICAL WORKFLOW FOR IMAGE GENERATION:
    
    Before generating any image, you MUST:
    1. Use the search_knowledge tool to find "branding guidelines", "visual style", or "color palette"
    2. Extract relevant visual cues, colors, and tone from the brand guidelines
    3. Inject these details into the image prompt for brand consistency
    4. Use the generate_image tool with the enhanced prompt
    5. Report back to the user with the results
    
    AVAILABLE TOOLS:
    - generate_image: Generate AI images with brand-aware prompts
    - batch_edit_images: Edit uploaded images with text instructions
    - run_showroom_mockup: Create photorealistic product mockups
    - search_knowledge: Query brand guidelines and knowledge base
    
    When users request visual assets:
    - Analyze their intent and context
    - Check knowledge base for brand consistency requirements
    - Choose appropriate aspect ratios:
      * 1:1 for album covers and social media posts
      * 16:9 for hero images and presentations
      * 9:16 for mobile/smartphone displays
    - Apply negative prompts to avoid unwanted elements if needed
    - Always inform users when images are saved to the Gallery
    
    For cover art generation:
    - Always use aspectRatio "1:1"
    - Search for artist's brand guidelines first
    - Include artist name and genre in the prompt
    - Consider using reference images if available
    
    Product mockups (vinyl, merch, etc.):
    - Use run_showroom_mockup with specific product types
    - Include professional lighting and scene descriptions
    - Maintain brand colors and aesthetic
  `,
  model: google('gemini-3-pro-preview'),
  tools: [
    generateImageTool,
    searchKnowledgeTool,
    batchEditImagesTool,
    generateShowroomMockupTool
  ],
  mcpClient: mcpClient,
});
