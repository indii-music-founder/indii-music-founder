/**
 * Video Generation Instrument
 *
 * Wraps the existing VideoGenerationService as an instrument for agent execution.
 * Supports both simple and long-form video generation with quota enforcement.
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
import { VideoGenerationService } from '@/services/video/VideoGenerationService';
import { subscriptionService } from '@/services/subscription/SubscriptionService';

export class VideoGenerationInstrument implements Instrument {
  metadata: InstrumentMetadata = {
    id: 'generate_video',
    name: 'Generate Video',
    description: 'Generate AI videos from text prompts using Veo 3.1. Supports multiple aspect ratios and durations.',
    category: 'generation',
    version: '1.0.0',
    author: 'indiiOS Core Team',
    isAsync: true,
    timeoutMs: 300000, // 5 minutes timeout
    cost: {
      type: 'quota',
      amount: 10 // Base cost per video generation
    },
    requiresApproval: true, // Always require approval for video generation
    requiredTier: 'pro',
    constraints: {
      maxDuration: 60,
      allowedFormats: ['mp4', 'mov', 'webm'],
      maxBatchSize: 1,
      rateLimitPerMinute: 2
    },
    computeType: 'cloud',
    preferredModel: 'veo-3.1-generate-preview',
    tags: ['ai', 'video', 'generation', 'creative', 'premium'],
    examples: [
      {
        input: {
          prompt: 'A serene ocean sunset with gentle waves',
          aspectRatio: '16:9',
          duration: 15,
          cameraMovement: 'Static'
        },
        description: 'Generate a short landscape video'
      },
      {
        input: {
          prompt: 'Product showcase video for headphones',
          aspectRatio: '9:16',
          duration: 30,
          cameraMovement: 'Pan left to right'
        },
        description: 'Generate a product video for social media'
      }
    ]
  };

  inputs: InstrumentInput[] = [
    {
      name: 'prompt',
      description: 'Text description of the desired video',
      required: true,
      schema: {
        type: 'string',
        minLength: 20,
        maxLength: 1000
      }
    },
    {
      name: 'aspectRatio',
      description: 'Aspect ratio of the output video',
      required: false,
      defaultValue: '16:9',
      schema: {
        type: 'string',
        enum: ['16:9', '9:16', '1:1'],
        default: '16:9'
      }
    },
    {
      name: 'duration',
      description: 'Duration in seconds (1-60)',
      required: false,
      defaultValue: 15,
      schema: {
        type: 'number',
        minimum: 1,
        maximum: 60,
        default: 15
      }
    },
    {
      name: 'cameraMovement',
      description: 'Type of camera movement',
      required: false,
      schema: {
        type: 'string',
        enum: ['Static', 'Pan left', 'Pan right', 'Zoom in', 'Zoom out', 'Rotate'],
        default: 'Static'
      }
    },
    {
      name: 'motionStrength',
      description: 'Amount of motion (0-1)',
      required: false,
      schema: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        default: 0.5
      }
    },
    {
      name: 'firstFrame',
      description: 'Base64 image to use as starting frame (for video-to-video)',
      required: false,
      schema: {
        type: 'string',
        format: 'uri'
      }
    },
    {
      name: 'negativePrompt',
      description: 'Things to avoid in the video',
      required: false,
      schema: {
        type: 'string',
        maxLength: 500
      }
    }
  ];

  outputs: InstrumentOutput[] = [
    {
      type: 'object',
      description: 'Job ID for async video generation',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique job ID' },
          status: { type: 'string', description: 'Job status' },
          estimatedTime: { type: 'number', description: 'Estimated completion time in seconds' }
        },
        required: ['id', 'status']
      }
    }
  ];

  private videoService = new VideoGenerationService();

  async execute(params: Record<string, any>): Promise<InstrumentResult> {
    const startTime = Date.now();

    try {
      // Get current user ID
      const { auth } = await import('@/services/firebase');
      if (!auth.currentUser) {
        return {
          success: false,
          error: 'User must be authenticated',
          metadata: { executionTimeMs: Date.now() - startTime }
        };
      }
      const userId = auth.currentUser.uid;

      // Check quota using subscription service
      const durationSeconds = params.duration || 15;
      const quotaCheck = await subscriptionService.canPerformAction(
        'generateVideo',
        durationSeconds,
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

      // Execute video generation
      const results = await this.videoService.generateVideo({
        prompt: params.prompt,
        aspectRatio: params.aspectRatio || '16:9',
        duration: params.duration || 15,
        cameraMovement: params.cameraMovement,
        motionStrength: params.motionStrength,
        firstFrame: params.firstFrame
      });

      if (!results || results.length === 0) {
        return {
          success: false,
          error: 'Failed to initiate video generation',
          metadata: { executionTimeMs: Date.now() - startTime }
        };
      }

      // Calculate estimated completion time (rough estimate: 5 seconds per second of video)
      const estimatedTime = durationSeconds * 5;

      return {
        success: true,
        data: {
          id: results[0].id,
          status: 'processing',
          estimatedTime
        },
        metadata: {
          executionTimeMs: Date.now() - startTime,
          cost: await this.estimateCost(params).then(e => e.amount),
          modelUsed: this.metadata.preferredModel,
          quotaImpact: {
            type: 'video_generation',
            amount: durationSeconds
          },
          additionalInfo: {
            aspectRatio: params.aspectRatio || '16:9',
            durationSeconds,
            cameraMovement: params.cameraMovement
          }
        }
      };
    } catch (error) {
      console.error('[VideoGenerationInstrument] Execution failed:', error);
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
    } else if (params.prompt.length < 20) {
      errors.push('Prompt must be at least 20 characters long');
    } else if (params.prompt.length > 1000) {
      errors.push('Prompt must be less than 1000 characters');
    }

    // Validate aspectRatio
    if (params.aspectRatio !== undefined) {
      const validRatios = ['16:9', '9:16', '1:1'];
      if (!validRatios.includes(params.aspectRatio)) {
        errors.push(`Aspect ratio must be one of: ${validRatios.join(', ')}`);
      }
    }

    // Validate duration
    if (params.duration !== undefined) {
      if (typeof params.duration !== 'number') {
        errors.push('Duration must be a number');
      } else if (params.duration < 1 || params.duration > 60) {
        errors.push('Duration must be between 1 and 60 seconds');
      }
    }

    // Validate cameraMovement
    if (params.cameraMovement !== undefined) {
      const validMovements = ['Static', 'Pan left', 'Pan right', 'Zoom in', 'Zoom out', 'Rotate'];
      if (!validMovements.includes(params.cameraMovement)) {
        errors.push(`Camera movement must be one of: ${validMovements.join(', ')}`);
      }
    }

    // Validate motionStrength
    if (params.motionStrength !== undefined) {
      if (typeof params.motionStrength !== 'number') {
        errors.push('Motion strength must be a number');
      } else if (params.motionStrength < 0 || params.motionStrength > 1) {
        errors.push('Motion strength must be between 0 and 1');
      }
    }

    // Validate firstFrame if provided
    if (params.firstFrame !== undefined) {
      if (typeof params.firstFrame !== 'string') {
        errors.push('First frame must be a valid image URL');
      } else if (!params.firstFrame.startsWith('data:image/')) {
        errors.push('First frame must be a base64 data URL');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async estimateCost(params: Record<string, any>): Promise<CostEstimate> {
    const duration = params.duration || 15;
    const baseCost = this.metadata.cost.amount;
    const durationCost = duration * 0.5; // $0.50 per second

    return {
      amount: baseCost + durationCost,
      type: 'exact',
      breakdown: {
        base_cost: baseCost,
        duration_factor: durationCost,
        total_seconds: duration
      }
    };
  }

  async requiresApproval(): Promise<boolean> {
    // Always require approval for video generation (expensive operation)
    return true;
  }

  async dryRun(params: Record<string, any>): Promise<{
    validation: ValidationResult;
    cost: CostEstimate;
  }> {
    const [validation, cost] = await Promise.all([
      this.validateInputs(params),
      this.estimateCost(params)
    ]);

    return {
      validation,
      cost
    };
  }
}
