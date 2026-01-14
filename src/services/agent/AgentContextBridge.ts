/**
 * Agent Context Bridge
 *
 * Bridges the existing AgentService with the new Instrument layer.
 * Allows agents to discover and execute instruments as if they were natural tools.
 */

import { SubscriptionTier } from '@/services/subscription/SubscriptionTier';
import { SubscriptionService, subscriptionService } from '@/services/subscription/SubscriptionService';
import { instrumentRegistry } from './instruments/InstrumentRegistry';
import { Instrument } from './instruments/InstrumentTypes';

export interface AgentInstrumentContext {
  /** Available instruments formatted for agent discovery */
  availableInstruments: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    cost: {
      type: string;
      amount: number;
    };
    requiresApproval: boolean;
    tierRequired?: string;
  }>;

  /** User's current subscription tier */
  currentTier: SubscriptionTier;

  /** Whether user has any quotas remaining */
  hasQuotaRemaining: boolean;

  /** Usage warnings if any */
  warnings: string[];
}

export class AgentContextBridge {
  private subscriptionService: SubscriptionService;
  private tier: SubscriptionTier = SubscriptionTier.FREE;

  constructor() {
    this.subscriptionService = subscriptionService;
  }

  /**
   * Build agent context with available instruments
   */
  async buildAgentContext(): Promise<AgentInstrumentContext> {
    // Load current subscription
    const subscription = await this.subscriptionService.getCurrentSubscription();
    this.tier = subscription.tier;

    // Get usage stats
    const usage = await this.subscriptionService.getCurrentUsageStats();

    // Get usage warnings
    const warnings = await this.subscriptionService.getUsageWarnings();
    const warningMessages = warnings.map(w => w.message);

    // Get all instruments and filter for current tier
    const allInstruments = instrumentRegistry.getAll();

    const availableInstruments = allInstruments.map(instrument => ({
      id: instrument.metadata.id,
      name: instrument.metadata.name,
      description: instrument.metadata.description,
      category: instrument.metadata.category,
      cost: instrument.metadata.cost,
      requiresApproval: instrument.metadata.requiresApproval,
      tierRequired: instrument.metadata.requiredTier
    })).filter(instrument => {
      // Filter based on tier requirements
      if (instrument.tierRequired === 'studio' && this.tier !== 'studio') {
        return false;
      }
      return true;
    });

    // Check if user has any quota remaining
    const hasQuotaRemaining = this.hasRemainingQuota(usage);

    return {
      availableInstruments,
      currentTier: this.tier,
      hasQuotaRemaining,
      warnings: warningMessages
    };
  }

  /**
   * Check if user has remaining quota for any operations
   */
  private hasRemainingQuota(usage: any): boolean {
    if (this.tier === SubscriptionTier.STUDIO) return true;

    return (
      usage.imagesRemaining > 0 ||
      usage.videoRemainingMinutes > 0 ||
      usage.aiChatTokensRemaining > 0 ||
      usage.storageRemainingGB > 0 ||
      usage.projectsRemaining > 0
    );
  }

  /**
   * Format instruments for LLM function calling
   */
  async formatInstrumentsForLLM(): Promise<Array<{
    name: string;
    description: string;
    parameters: any;
  }>> {
    const context = await this.buildAgentContext();

    return context.availableInstruments.map(instrument => ({
      name: `use_instrument_${instrument.id}`,
      description: `${instrument.name}: ${instrument.description}. Cost: ${instrument.cost.amount} ${instrument.cost.type}${instrument.requiresApproval ? ' (requires approval)' : ''}`,
      parameters: {
        type: 'OBJECT',
        properties: {
          instrument_id: {
            type: 'STRING',
            description: `ID of the instrument to use: ${instrument.id}`,
            enum: [instrument.id]
          },
          parameters: {
            type: 'OBJECT',
            description: 'Parameters to pass to the instrument',
            properties: this.getInstrumentParameters(instrument.id),
            required: [] // Will be filled per instrument
          }
        },
        required: ['instrument_id', 'parameters']
      }
    }));
  }

  /**
   * Get parameter schema for a specific instrument
   */
  private getInstrumentParameters(instrumentId: string): any {
    const instrument = instrumentRegistry.get(instrumentId);
    if (!instrument) return {};

    return instrument.inputs.reduce((acc, input) => {
      acc[input.name] = {
        type: (input.schema.type as string).toUpperCase(),
        description: input.description,
        ...(input.schema.enum && { enum: input.schema.enum }),
        ...(input.schema.default !== undefined && { default: input.schema.default })
      };

      if (input.required) {
        // Note: In actual implementation, we'd build the required array separately
        // as it can't be included in the properties object
      }

      return acc;
    }, {} as Record<string, any>);
  }

  /**
   * Execute an instrument from agent context
   */
  async executeAgentInstrument(
    instrumentId: string,
    parameters: Record<string, any>,
    context?: any
  ): Promise<any> {
    const instrument = instrumentRegistry.get(instrumentId);
    if (!instrument) {
      throw new Error(`Instrument not found: ${instrumentId}`);
    }

    // Check if approval is required
    const requiresApproval = await (instrument as any).requiresApproval?.(parameters) ?? instrument.metadata.requiresApproval;

    if (requiresApproval) {
      // Trigger approval flow
      const approved = await this.requestApproval(instrumentId, parameters);
      if (!approved) {
        throw new Error('User denied approval for instrument execution');
      }
    }

    // Check quota before execution
    const quotaCheck = await this.checkQuotaBeforeExecution(instrumentId, parameters);
    if (!quotaCheck.allowed) {
      throw new Error(quotaCheck.reason);
    }

    // Execute instrument
    const result = await instrumentRegistry.execute(instrumentId, parameters);

    if (!result.success) {
      throw new Error(result.error || 'Instrument execution failed');
    }

    return result.data;
  }

  /**
   * Request user approval via UI dialog
   */
  private async requestApproval(
    instrumentId: string,
    parameters: Record<string, any>
  ): Promise<boolean> {
    const instrument = instrumentRegistry.get(instrumentId);
    if (!instrument) return false;

    const cost = await instrument.estimateCost(parameters);

    return new Promise((resolve) => {
      // Dispatch custom event that UI components can listen to
      window.dispatchEvent(
        new CustomEvent('instrument-approval-request', {
          detail: {
            instrumentId,
            instrumentName: instrument.metadata.name,
            parameters,
            estimatedCost: cost.amount,
            onApprove: () => resolve(true),
            onDeny: () => resolve(false)
          }
        })
      );
    });
  }

  /**
   * Check quota before executing instrument
   */
  private async checkQuotaBeforeExecution(
    instrumentId: string,
    parameters: Record<string, any>
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Map instrument type to quota action
    if (instrumentId.includes('image')) {
      return await this.subscriptionService.canPerformAction('generateImage', parameters.count || 1);
    } else if (instrumentId.includes('video')) {
      const duration = parameters.duration || 15;
      return await this.subscriptionService.canPerformAction('generateVideo', duration);
    }

    return { allowed: true };
  }

  /**
   * Get human-readable instrument descriptions for agent context
   */
  async getAgentInstrumentDescriptions(): Promise<string> {
    const context = await this.buildAgentContext();

    if (context.availableInstruments.length === 0) {
      return 'No instruments are currently available.';
    }

    const descriptions = context.availableInstruments.map(instrument => {
      const approvalNote = instrument.requiresApproval ? ' ⚠️ Requires approval' : '';
      const costNote = ` (${instrument.cost.amount} ${instrument.cost.type || 'credits'})`;
      const emojiMap: Record<string, string> = {
        'generation': '🎨',
        'utility': '🔧',
        'analysis': '🔍',
        'communication': '💬',
        'file_operations': '📁',
        'media_processing': '🎬',
        'data_processing': '📊'
      };

      const categoryEmoji = emojiMap[instrument.category] || '🛠️';

      return `- ${categoryEmoji} **${instrument.name}** ${costNote}: ${instrument.description}${approvalNote}`;
    }).join('\n');

    return `## Available Instruments\n\n${descriptions}\n\n${context.hasQuotaRemaining ? '' : '⚠️ You have reached your quota limit. Upgrade your plan to continue.'}`;
  }
}

export const agentContextBridge = new AgentContextBridge();
