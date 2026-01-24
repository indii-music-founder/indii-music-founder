/**
 * Image Generation Instrument
 *
 * Wraps the existing ImageGenerationService as an instrument for agent execution.
 * This allows agents to programmatically generate images with full quota checking and tracking.
 */

import {
  Instrument,
  InstrumentMetadata,
  InstrumentInput,
  InstrumentOutput,
  InstrumentResult,
  ValidationResult,
  CostEstimate
} from './InstrumentTypes';
import { ImageGenerationService } from '@/services/image/ImageGenerationService';
import { subscriptionService } from '@/services/subscription/SubscriptionService';
import { CacheService } from '@/services/cache/CacheService';

export class ImageGenerationInstrument implements Instrument {
  metadata: InstrumentMetadata = {
    id: 'generate_image',
    name: 'Generate Image',
    description: 'Generate AI images using text prompts with support for various aspect ratios and styles',
    category: 'generation',
    version: '1.0.0',
    author: 'indiiOS Core Team',
    isAsync: true,
    timeoutMs: 120000, // 2 minutes timeout
    cost: {
      type: 'quota',
      amount: 1
    },
    requiresApproval: false,
    requiredTier: 'free',
    constraints: {
      maxResolution: '2048x2048',
      allowedFormats: ['png', 'jpg', 'webp'],
      maxBatchSize: 4,
      rateLimitPerMinute: 10
    },
    computeType: 'cloud',
    preferredModel: 'gemini-3-pro-image-preview',
    fallbackModels: ['gemini-3-flash-image-preview'],
    tags: ['ai', 'image', 'generation', 'creative'],
    examples: [
      {
        input: {
          prompt: 'A futuristic city at sunset, cyberpunk style',
          aspectRatio: '16:9',
          count: 1
        },
        description: 'Generate a single landscape image'
      },
      {
        input: {
          prompt: 'Album cover art for electronic music',
          aspectRatio: '1:1',
          count: 4
        },
        description: 'Generate multiple cover art options'
      }
    ]
  };

  inputs: InstrumentInput[] = [
    {
      name: 'prompt',
      description: 'Text description of the desired image',
      required: true,
      schema: {
        type: 'string',
        minLength: 10,
        maxLength: 1000
      }
    },
    {
      name: 'aspectRatio',
      description: 'Aspect ratio of the output image',
      required: false,
      defaultValue: '1:1',
      schema: {
        type: 'string',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2'],
        default: '1:1'
      }
    },
    {
      name: 'count',
      description: 'Number of images to generate (1-4)',
      required: false,
      defaultValue: 1,
      schema: {
        type: 'number',
        minimum: 1,
        maximum: 4,
        default: 1
      }
    },
    {
      name: 'negativePrompt',
      description: 'Things to avoid in the image',
      required: false,
      schema: {
        type: 'string',
        maxLength: 500
      }
    },
    {
      name: 'seed',
      description: 'Random seed for reproducibility',
      required: false,
      schema: {
        type: 'number',
        minimum: 0,
        maximum: 4294967295
      }
    }
  ];

  outputs: InstrumentOutput[] = [
    {
      type: 'array',
      description: 'Array of generated images with URLs and metadata',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique image ID' },
            url: { type: 'string', description: 'Base64 data URL of the image' },
            prompt: { type: 'string', description: 'The prompt used to generate the image' }
          },
          required: ['id', 'url', 'prompt']
        }
      }
    }
  ];

  private imageService = new ImageGenerationService();
  private cache = new CacheService();

  async execute(params: Record<string, any>): Promise<InstrumentResult> {
    const startTime = Date.now();

    try {
      // Get current user ID from auth
      const { auth } = await import('@/services/firebase');
      let userId = auth.currentUser?.uid;

      if (!userId) {
        if (import.meta.env.DEV) {
          console.warn("[ImageGenerationInstrument] Anonymous user in DEV, using mock ID.");
          userId = 'dev_user_anonymous';
        } else {
          return {
            success: false,
            error: 'User must be authenticated',
            metadata: { executionTimeMs: Date.now() - startTime }
          };
        }
      }

      // Check quota using subscription service
      const quotaCheck = await subscriptionService.canPerformAction(
        'generateImage',
        params.count || 1,
        userId
      );

      if (!quotaCheck.allowed) {
        return {
          success: false,
          error: quotaCheck.reason,
          metadata: {
            executionTimeMs: Date.now() - startTime,
            additionalInfo: {
              upgradeRequired: quotaCheck.upgradeRequired,
              suggestedTier: quotaCheck.suggestedTier,
              upgradeUrl: quotaCheck.upgradeUrl
            }
          }
        };
      }

      // Validate inputs
      const validation = await this.validateInputs(params);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', '),
          metadata: { executionTimeMs: Date.now() - startTime }
        };
      }

      // Execute image generation
      const results = await this.imageService.generateImages({
        prompt: params.prompt,
        aspectRatio: params.aspectRatio || '1:1',
        count: params.count || 1,
        negativePrompt: params.negativePrompt,
        seed: params.seed
      });

      if (!results || results.length === 0) {
        return {
          success: false,
          error: 'No images were generated',
          metadata: { executionTimeMs: Date.now() - startTime }
        };
      }

      // Cache results for debugging
      const cacheKey = `instrument:${this.metadata.id}:${Date.now()}`;
      this.cache.set(cacheKey, results, 3600000); // Cache for 1 hour

      return {
        success: true,
        data: results,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          cost: await this.estimateCost(params).then(e => e.amount),
          modelUsed: this.metadata.preferredModel,
          quotaImpact: {
            type: 'image_generation',
            amount: results.length
          },
          additionalInfo: {
            aspectRatio: params.aspectRatio || '1:1',
            imagesGenerated: results.length
          }
        }
      };
    } catch (error) {
      console.error('[ImageGenerationInstrument] Execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorDetails: error,
        metadata: { executionTimeMs: Date.now() - startTime }
      };
    }
  }

  async validateInputs(params: Record<string, any>): Promise<ValidationResult> {
    const errors: string[] = [];

    // Check required fields
    if (!params.prompt || typeof params.prompt !== 'string') {
      errors.push('Prompt is required and must be a string');
    } else if (params.prompt.length < 10) {
      errors.push('Prompt must be at least 10 characters long');
    } else if (params.prompt.length > 1000) {
      errors.push('Prompt must be less than 1000 characters');
    }

    // Validate count
    if (params.count !== undefined) {
      if (typeof params.count !== 'number') {
        errors.push('Count must be a number');
      } else if (params.count < 1 || params.count > 4) {
        errors.push('Count must be between 1 and 4');
      }
    }

    // Validate aspectRatio
    if (params.aspectRatio !== undefined) {
      const validRatios = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2'];
      if (!validRatios.includes(params.aspectRatio)) {
        errors.push(`Aspect ratio must be one of: ${validRatios.join(', ')}`);
      }
    }

    // Validate seed
    if (params.seed !== undefined) {
      if (typeof params.seed !== 'number') {
        errors.push('Seed must be a number');
      } else if (params.seed < 0 || params.seed > 4294967295) {
        errors.push('Seed must be between 0 and 4294967295');
      }
    }

    // Validate negativePrompt
    if (params.negativePrompt !== undefined && params.negativePrompt.length > 500) {
      errors.push('Negative prompt must be less than 500 characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async estimateCost(params: Record<string, any>): Promise<CostEstimate> {
    const count = params.count || 1;
    return {
      amount: count * this.metadata.cost.amount,
      type: 'exact',
      breakdown: {
        'per_image_cost': this.metadata.cost.amount,
        'quantity': count
      }
    };
  }

  async requiresApproval(params: Record<string, any>): Promise<boolean> {
    // Check if this is a large batch generation
    const count = params.count || 1;
    return count > 2;
  }
}
