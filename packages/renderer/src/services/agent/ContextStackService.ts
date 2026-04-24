/**
 * ContextStackService
 *
 * Manages multi-turn conversation context using a stack-based approach.
 * Maintains context depth, enables context switching, and tracks conversation history.
 *
 * Features:
 * - Stack-based context management (push/pop/peek)
 * - Context summarization for memory efficiency
 * - Cross-turn context inheritance
 * - Maximum depth enforcement
 */

import { logger } from '@/utils/logger';

export interface ContextFrame {
  frameId: string;
  depth: number;
  timestamp: number;
  topic: string;
  content: Record<string, unknown>;
  metadata: {
    tokenCount: number;
    parentFrameId?: string;
    childFrameIds: string[];
  };
}

interface ContextStackState {
  frames: ContextFrame[];
  currentDepth: number;
  maxDepth: number;
  totalTokensUsed: number;
}

interface ContextSummary {
  key: string;
  topic: string;
  timestamp: number;
  contentHash: string;
}

export class ContextStackService {
  private state: ContextStackState = {
    frames: [],
    currentDepth: 0,
    maxDepth: 5,
    totalTokensUsed: 0
  };
  private frameMap: Map<string, ContextFrame> = new Map();
  private summaryCache: Map<string, ContextSummary> = new Map();
  private tokenBudget = 8000;
  private warningThreshold = 0.8;

  /**
   * Push new context frame
   */
  push(topic: string, content: Record<string, unknown>, metadata?: { tokenCount?: number }): ContextFrame {
    if (this.state.currentDepth >= this.state.maxDepth) {
      logger.warn(`[ContextStack] Max depth (${this.state.maxDepth}) reached, removing oldest frame`);
      this.pop();
    }

    const frameId = this.generateFrameId();
    const lastFrame = this.state.frames[this.state.frames.length - 1];
    const parentFrameId = lastFrame?.frameId;

    const frame: ContextFrame = {
      frameId,
      depth: this.state.currentDepth,
      timestamp: Date.now(),
      topic,
      content,
      metadata: {
        tokenCount: metadata?.tokenCount || 0,
        parentFrameId,
        childFrameIds: []
      }
    };

    this.state.frames.push(frame);
    this.frameMap.set(frameId, frame);
    this.state.currentDepth++;
    this.state.totalTokensUsed += frame.metadata.tokenCount;

    if (parentFrameId) {
      const parentFrame = this.frameMap.get(parentFrameId);
      if (parentFrame) {
        parentFrame.metadata.childFrameIds.push(frameId);
      }
    }

    this.checkTokenBudget();

    logger.debug(
      `[ContextStack] Pushed frame ${frameId} at depth ${frame.depth} (${frame.metadata.tokenCount} tokens)`
    );

    return frame;
  }

  /**
   * Pop current context frame
   */
  pop(): ContextFrame | null {
    if (this.state.frames.length === 0) {
      logger.warn('[ContextStack] Cannot pop from empty stack');
      return null;
    }

    const frame = this.state.frames.pop() ?? null;
    if (!frame) return null;

    this.state.currentDepth--;
    this.state.totalTokensUsed -= frame.metadata.tokenCount;
    this.frameMap.delete(frame.frameId);

    logger.debug(`[ContextStack] Popped frame ${frame.frameId}`);

    return frame;
  }

  /**
   * Peek at current frame without removing
   */
  peek(): ContextFrame | null {
    if (this.state.frames.length === 0) return null;
    const frame = this.state.frames[this.state.frames.length - 1];
    return frame ?? null;
  }

  /**
   * Get frame by ID
   */
  getFrame(frameId: string): ContextFrame | null {
    return this.frameMap.get(frameId) || null;
  }

  /**
   * Get all frames
   */
  getAllFrames(): ContextFrame[] {
    return [...this.state.frames];
  }

  /**
   * Get context at specific depth
   */
  getContextAtDepth(depth: number): ContextFrame | null {
    return this.state.frames.find((f) => f.depth === depth) || null;
  }

  /**
   * Build context window for agent
   */
  buildContextWindow(): Record<string, unknown> {
    const recentFrames = this.state.frames.slice(
      Math.max(0, this.state.frames.length - 3)
    );

    return {
      currentFrame: this.peek(),
      recentFrames,
      contextDepth: this.state.currentDepth,
      tokenUsage: {
        used: this.state.totalTokensUsed,
        budget: this.tokenBudget,
        percentageUsed: (this.state.totalTokensUsed / this.tokenBudget) * 100
      }
    };
  }

  /**
   * Clear all frames
   */
  clear(): void {
    this.state.frames = [];
    this.frameMap.clear();
    this.summaryCache.clear();
    this.state.currentDepth = 0;
    this.state.totalTokensUsed = 0;
    logger.debug('[ContextStack] Cleared all frames');
  }

  /**
   * Get service state
   */
  getState(): ContextStackState {
    return { ...this.state };
  }

  /**
   * Summarize frame for memory efficiency
   */
  summarizeFrame(frameId: string): ContextSummary | null {
    const frame = this.frameMap.get(frameId);
    if (!frame) return null;

    const contentStr = JSON.stringify(frame.content);
    const hash = this.simpleHash(contentStr);

    const summary: ContextSummary = {
      key: frame.frameId,
      topic: frame.topic,
      timestamp: frame.timestamp,
      contentHash: hash
    };

    this.summaryCache.set(frameId, summary);
    return summary;
  }

  /**
   * Get summary cache
   */
  getSummaryCache(): Map<string, ContextSummary> {
    return new Map(this.summaryCache);
  }

  /**
   * Check if frame exists
   */
  frameExists(frameId: string): boolean {
    return this.frameMap.has(frameId);
  }

  /**
   * Get token budget status
   */
  getTokenBudgetStatus() {
    return {
      used: this.state.totalTokensUsed,
      budget: this.tokenBudget,
      available: this.tokenBudget - this.state.totalTokensUsed,
      percentageUsed: (this.state.totalTokensUsed / this.tokenBudget) * 100,
      isWarning: this.state.totalTokensUsed / this.tokenBudget > this.warningThreshold,
      isExceeded: this.state.totalTokensUsed > this.tokenBudget
    };
  }

  // ========================================================================
  // Private Helpers
  // ========================================================================

  private checkTokenBudget(): void {
    const percentageUsed = this.state.totalTokensUsed / this.tokenBudget;

    if (percentageUsed > this.warningThreshold && percentageUsed < 1.0) {
      logger.warn(
        `[ContextStack] Token budget warning: ${(percentageUsed * 100).toFixed(1)}% used`
      );
    } else if (percentageUsed >= 1.0) {
      logger.error('[ContextStack] Token budget exceeded!');
      // Trim oldest frames to stay within budget
      while (this.state.totalTokensUsed > this.tokenBudget && this.state.frames.length > 1) {
        const oldestFrame = this.state.frames.shift();
        if (oldestFrame) {
          this.state.totalTokensUsed -= oldestFrame.metadata.tokenCount;
          this.frameMap.delete(oldestFrame.frameId);
        }
      }
    }
  }

  private generateFrameId(): string {
    return `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}

// ============================================================================
// Singleton
// ============================================================================

let contextStackService: ContextStackService | null = null;

export function initializeContextStackService(): ContextStackService {
  if (!contextStackService) {
    contextStackService = new ContextStackService();
  }
  return contextStackService;
}

export function getContextStackService(): ContextStackService {
  if (!contextStackService) {
    contextStackService = new ContextStackService();
  }
  return contextStackService;
}
