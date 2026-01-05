/**
 * Instrument Registry
 *
 * Central registry for all instruments that agents can use.
 * Provides discovery, validation, and execution capabilities.
 */

import {
  Instrument,
  InstrumentMetadata,
  InstrumentResult,
  InstrumentRegistryEntry,
  InstrumentFilter
} from './InstrumentTypes';
import { ImageGenerationInstrument } from './ImageGenerationInstrument';
import { VideoGenerationInstrument } from './VideoGenerationInstrument';
import { CacheService } from '@/services/cache/CacheService';

class InstrumentRegistry {
  private instruments: Map<string, Instrument> = new Map();
  private usageStats: Map<string, InstrumentRegistryEntry['usageStats']> = new Map();
  private cache: CacheService;

  constructor() {
    this.cache = new CacheService();
    this.initializeCoreInstruments();
    this.loadUsageStats();
  }

  /**
   * Initialize core instruments
   */
  private initializeCoreInstruments(): void {
    // Register core instruments
    this.register(new ImageGenerationInstrument());
    this.register(new VideoGenerationInstrument());

    // Additional instruments can be added here as they're implemented
    // e.g., AudioAnalysisInstrument, TextToSpeechInstrument, etc.
  }

  /**
   * Load usage statistics from cache (placeholder - would load from Firestore in production)
   */
  private loadUsageStats(): void {
    // Initialize empty stats for all registered instruments
    this.instruments.forEach((instrument, id) => {
      if (!this.usageStats.has(id)) {
        this.usageStats.set(id, {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0
        });
      }
    });
  }

  /**
   * Register an instrument in the registry
   */
  register(instrument: Instrument): void {
    const id = instrument.metadata.id;

    // Validate instrument before registration
    if (this.validateInstrument(instrument)) {
      this.instruments.set(id, instrument);
      console.log(`[InstrumentRegistry] Registered instrument: ${id}`);
    } else {
      throw new Error(`Invalid instrument: ${id}`);
    }
  }

  /**
   * Unregister an instrument from the registry
   */
  unregister(instrumentId: string): void {
    if (this.instruments.delete(instrumentId)) {
      this.usageStats.delete(instrumentId);
      console.log(`[InstrumentRegistry] Unregistered instrument: ${instrumentId}`);
    }
  }

  /**
   * Get an instrument by ID
   */
  get(instrumentId: string): Instrument | undefined {
    return this.instruments.get(instrumentId);
  }

  /**
   * Check if an instrument exists
   */
  has(instrumentId: string): boolean {
    return this.instruments.has(instrumentId);
  }

  /**
   * Get all registered instruments
   */
  getAll(): Instrument[] {
    return Array.from(this.instruments.values());
  }

  /**
   * Get instruments by IDs (with filtering for available)
   */
  getByIds(ids: string[]): Instrument[] {
    return ids
      .map(id => this.get(id))
      .filter((i): i is Instrument => i !== undefined);
  }

  /**
   * Get registry entries with metadata
   */
  getRegistryEntries(): InstrumentRegistryEntry[] {
    return Array.from(this.instruments.entries()).map(([id, instrument]) => ({
      ...instrument,
      available: true,
      lastUpdated: Date.now(),
      usageStats: this.usageStats.get(id) || {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0
      }
    }));
  }

  /**
   * Filter instruments by criteria
   */
  find(filter: InstrumentFilter): Instrument[] {
    let results = this.getAll();

    // Filter by category
    if (filter.categories && filter.categories.length > 0) {
      results = results.filter(i => filter.categories!.includes(i.metadata.category));
    }

    // Filter by compute type
    if (filter.computeTypes && filter.computeTypes.length > 0) {
      results = results.filter(i => filter.computeTypes!.includes(i.metadata.computeType));
    }

    // Filter by economic model
    if (filter.economicModels && filter.economicModels.length > 0) {
      results = results.filter(i => filter.economicModels!.includes(i.metadata.cost.type));
    }

    // Filter by approval requirement
    if (filter.skipApprovalRequired) {
      results = results.filter(i => !i.metadata.requiresApproval);
    }

    // Filter by tier
    if (filter.tier) {
      results = results.filter(i => {
        const requiredTier = i.metadata.requiredTier;
        if (!requiredTier || requiredTier === 'free') return true;
        // In production, this would check against user's actual tier
        return true;
      });
    }

    // Filter by tags
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(i =>
        filter.tags!.some(tag => i.metadata.tags?.includes(tag))
      );
    }

    // Search by name/description
    if (filter.search) {
      const search = filter.search.toLowerCase();
      results = results.filter(
        i =>
          i.metadata.name.toLowerCase().includes(search) ||
          i.metadata.description.toLowerCase().includes(search) ||
          i.metadata.id.toLowerCase().includes(search)
      );
    }

    return results;
  }

  /**
   * Get instruments by category
   */
  getByCategory(category: string): Instrument[] {
    return this.getAll().filter(i => i.metadata.category === category);
  }

  /**
   * Get instruments by compute type
   */
  getByComputeType(computeType: string): Instrument[] {
    return this.getAll().filter(i => i.metadata.computeType === computeType);
  }

  /**
   * Execute an instrument with tracking
   */
  async execute(
    instrumentId: string,
    params: Record<string, any>,
    options?: {
      onProgress?: (progress: number, message?: string) => void;
      timeoutMs?: number;
    }
  ): Promise<InstrumentResult> {
    const instrument = this.get(instrumentId);
    if (!instrument) {
      return {
        success: false,
        error: `Instrument not found: ${instrumentId}`,
        metadata: { executionTimeMs: 0 }
      };
    }

    // Update usage stats
    const stats = this.usageStats.get(instrumentId) || {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0
    };
    stats.totalExecutions++;

    try {
      // Execute with optional timeout
      let result: InstrumentResult;

      if (options?.timeoutMs) {
        result = await Promise.race([
          instrument.execute(params),
          new Promise<InstrumentResult>((_, reject) =>
            setTimeout(() => reject('Timeout'), options!.timeoutMs)
          )
        ]) as InstrumentResult;
      } else {
        result = await instrument.execute(params);
      }

      // Update stats on success
      if (result.success) {
        stats.successfulExecutions++;
        stats.lastExecutionTime = Date.now();
      } else {
        stats.failedExecutions++;
      }

      return result;
    } catch (error) {
      stats.failedExecutions++;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
        errorDetails: error,
        metadata: { executionTimeMs: 0 }
      };
    } finally {
      this.usageStats.set(instrumentId, stats);
    }
  }

  /**
   * Execute multiple instruments in parallel
   */
  async executeBatch(executions: Array<{ instrumentId: string; params: Record<string, any> }>): Promise<Record<string, InstrumentResult>> {
    const results: Record<string, InstrumentResult> = {};

    await Promise.all(
      executions.map(async ({ instrumentId, params }) => {
        if (!results[instrumentId]) {
          results[instrumentId] = await this.execute(instrumentId, params);
        }
      })
    );

    return results;
  }

  /**
   * Get usage statistics for an instrument
   */
  getUsageStats(instrumentId: string): InstrumentRegistryEntry['usageStats'] | undefined {
    return this.usageStats.get(instrumentId);
  }

  /**
   * Get total usage statistics across all instruments
   */
  getTotalUsageStats(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    mostUsedInstrument?: string;
  } {
    let totalExecutions = 0;
    let successfulExecutions = 0;
    let failedExecutions = 0;
    let mostUsedInstrument: string | undefined;
    let mostUsedCount = 0;

    this.usageStats.forEach((stats, id) => {
      totalExecutions += stats.totalExecutions;
      successfulExecutions += stats.successfulExecutions;
      failedExecutions += stats.failedExecutions;

      if (stats.totalExecutions > mostUsedCount) {
        mostUsedCount = stats.totalExecutions;
        mostUsedInstrument = id;
      }
    });

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      mostUsedInstrument
    };
  }

  /**
   * Validate instrument metadata
   */
  private validateInstrument(instrument: Instrument): boolean {
    const { metadata, inputs, outputs } = instrument;

    // Validate required fields
    if (!metadata.id || !metadata.name || !metadata.description) {
      return false;
    }

    // Validate inputs
    if (!Array.isArray(inputs) || inputs.length === 0) {
      return false;
    }

    // Validate that required inputs are marked
    const hasRequiredInput = inputs.some(i => i.required);
    if (!hasRequiredInput && inputs.length > 0) {
      // At least one input should be required for non-trivial instruments
      return true; // Still valid, unusual but acceptable
    }

    // Validate outputs
    if (!Array.isArray(outputs) || outputs.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Clear all registry data
   */
  clear(): void {
    this.instruments.clear();
    this.usageStats.clear();
  }

  /**
   * Export registry state (for debugging)
   */
  exportState(): {
    instruments: string[];
    stats: Record<string, any>;
  } {
    return {
      instruments: Array.from(this.instruments.keys()),
      stats: Object.fromEntries(this.usageStats)
    };
  }
}

// Singleton instance
export const instrumentRegistry = new InstrumentRegistry();
