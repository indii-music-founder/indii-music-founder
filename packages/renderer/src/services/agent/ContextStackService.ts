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
    const parentFrameId = this.state.frames.length > 0
      ? this.state.frames[this.state.frames.length - 1]!.frameId
      : undefined;

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
    return this.state.frames[this.state.frames.length - 1] ?? null;
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
  // Phase 2: Multi-Turn Summarization & Persistence
  // ========================================================================

  /**
   * Produce a token-efficient summary of the conversation history.
   * Used for prompt injection via AgentContext.contextSummary.
   *
   * @param maxChars Maximum character budget for the summary (default 2000)
   */
  summarizeForPrompt(maxChars: number = 2000): string {
    if (this.state.frames.length === 0) return '';

    const lines: string[] = [`CONVERSATION HISTORY (${this.state.frames.length} turns):`];
    let totalChars = lines[0]!.length;

    for (let i = 0; i < this.state.frames.length; i++) {
      const frame = this.state.frames[i]!;
      const turnNum = i + 1;

      // Truncate topic to 80 chars
      const topic = frame.topic.length > 80
        ? frame.topic.substring(0, 77) + '...'
        : frame.topic;

      // Build content summary
      const contentKeys = Object.keys(frame.content);
      const contentSummary = contentKeys.length > 0
        ? ` [${contentKeys.slice(0, 3).join(', ')}${contentKeys.length > 3 ? '...' : ''}]`
        : '';

      const line = `Turn ${turnNum}: "${topic}"${contentSummary} (${frame.metadata.tokenCount} tokens)`;

      if (totalChars + line.length > maxChars) {
        lines.push(`... (${this.state.frames.length - i} older turns omitted)`);
        break;
      }

      lines.push(line);
      totalChars += line.length;
    }

    return lines.join('\n');
  }

  /**
   * Serialize the entire stack state to a JSON string for persistence.
   */
  serialize(): string {
    return JSON.stringify({
      frames: this.state.frames,
      currentDepth: this.state.currentDepth,
      maxDepth: this.state.maxDepth,
      totalTokensUsed: this.state.totalTokensUsed,
    });
  }

  /**
   * Restore the stack from a serialized JSON string.
   * Validates structure before accepting.
   */
  restore(serialized: string): void {
    try {
      const parsed = JSON.parse(serialized);

      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.frames)) {
        logger.warn('[ContextStack] Restore failed: invalid structure');
        return;
      }

      // Validate each frame has required fields
      const validFrames = parsed.frames.filter((frame: unknown): frame is ContextFrame => {
        if (typeof frame !== 'object' || frame === null) return false;
        const f = frame as Record<string, unknown>;
        return (
          typeof f.frameId === 'string' &&
          typeof f.depth === 'number' &&
          typeof f.timestamp === 'number' &&
          typeof f.topic === 'string' &&
          typeof f.content === 'object' &&
          typeof f.metadata === 'object'
        );
      });

      // Rebuild internal state
      this.state.frames = validFrames;
      this.state.currentDepth = typeof parsed.currentDepth === 'number' ? parsed.currentDepth : validFrames.length;
      this.state.maxDepth = typeof parsed.maxDepth === 'number' ? parsed.maxDepth : 5;
      this.state.totalTokensUsed = typeof parsed.totalTokensUsed === 'number'
        ? parsed.totalTokensUsed
        : validFrames.reduce((acc: number, f: ContextFrame) => acc + f.metadata.tokenCount, 0);

      // Rebuild frameMap
      this.frameMap.clear();
      for (const frame of validFrames) {
        this.frameMap.set(frame.frameId, frame);
      }

      logger.debug(`[ContextStack] Restored ${validFrames.length} frames`);
    } catch (error) {
      logger.error('[ContextStack] Failed to restore from serialized data:', error);
    }
  }

  /**
   * Convert internal frames to the Phase 2 ContextFrame format
   * used by AgentContext.contextStack.
   *
   * This bridges the existing ContextStackService frame format
   * (frameId, depth, topic, content) to the Phase 2 ContextFrame format
   * (turnId, userMessage, agentResponse, toolCalls, decisions, memoryWrites).
   */
  toPhase2Frames(): import('@/services/agent/types').ContextFrame[] {
    return this.state.frames.map((frame) => ({
      turnId: frame.frameId,
      timestamp: frame.timestamp,
      userMessage: frame.topic,
      agentResponse: typeof frame.content.response === 'string'
        ? frame.content.response
        : JSON.stringify(frame.content),
      toolCalls: Array.isArray(frame.content.toolCalls)
        ? (frame.content.toolCalls as { name: string; args: unknown; result: unknown }[])
        : [],
      decisions: Array.isArray(frame.content.decisions)
        ? (frame.content.decisions as string[])
        : [],
      memoryWrites: Array.isArray(frame.content.memoryWrites)
        ? (frame.content.memoryWrites as string[])
        : [],
    }));
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
// Singleton (Legacy API)
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

// ============================================================================
// Phase 2: ContextStackServiceImpl — ContextFrame-based stack
// ============================================================================

import type { ContextFrame as Phase2ContextFrame } from '@/services/agent/types';

interface ContextStackImplConfig {
  /** Maximum number of frames to retain (FIFO eviction) */
  maxFrames: number;
  /** Maximum characters for summarize() output */
  maxSummaryChars: number;
}

const DEFAULT_IMPL_CONFIG: ContextStackImplConfig = {
  maxFrames: 20,
  maxSummaryChars: 2000,
};

/**
 * Phase 2 context stack implementation operating on the Phase 2 ContextFrame type.
 *
 * Provides a rolling-window stack of conversational turns with:
 * - FIFO eviction when maxFrames exceeded
 * - Structured summarization for prompt injection
 * - JSON serialization/restoration for cross-session persistence
 * - Static frame builder for ergonomic creation
 */
export class ContextStackServiceImpl {
  private frames: Phase2ContextFrame[] = [];
  private readonly config: ContextStackImplConfig;

  constructor(config?: Partial<ContextStackImplConfig>) {
    this.config = { ...DEFAULT_IMPL_CONFIG, ...config };
  }

  // ==========================================================================
  // Stack Operations
  // ==========================================================================

  get size(): number {
    return this.frames.length;
  }

  get isEmpty(): boolean {
    return this.frames.length === 0;
  }

  push(frame: Phase2ContextFrame): void {
    this.frames.push(frame);
    // FIFO eviction
    while (this.frames.length > this.config.maxFrames) {
      this.frames.shift();
    }
  }

  pop(): Phase2ContextFrame | undefined {
    return this.frames.pop();
  }

  peek(): Phase2ContextFrame | undefined {
    return this.frames.length > 0 ? this.frames[this.frames.length - 1] : undefined;
  }

  /**
   * Get the most recent N frames in reverse chronological order (newest first).
   */
  getRecentFrames(count: number): Phase2ContextFrame[] {
    const actual = Math.min(count, this.frames.length);
    return this.frames.slice(-actual).reverse();
  }

  clear(): void {
    this.frames = [];
  }

  // ==========================================================================
  // Summarization
  // ==========================================================================

  /**
   * Produce a token-efficient summary of the conversation history.
   */
  summarize(): string {
    if (this.frames.length === 0) return '';

    const lines: string[] = [`CONVERSATION HISTORY (${this.frames.length} turns):`];
    let totalChars = lines[0]!.length;

    for (let i = 0; i < this.frames.length; i++) {
      const frame = this.frames[i]!;
      const turnNum = i + 1;

      // Truncate user message for summary
      const msg = frame.userMessage.length > 80
        ? frame.userMessage.substring(0, 77) + '...'
        : frame.userMessage;

      // Build details
      const details: string[] = [];
      if (frame.toolCalls.length > 0) {
        details.push(`tools: ${frame.toolCalls.map(tc => tc.name).join(', ')}`);
      }
      if (frame.decisions.length > 0) {
        details.push(`decisions: ${frame.decisions.join(', ')}`);
      }

      const detailStr = details.length > 0 ? ` [${details.join(' | ')}]` : '';
      const line = `Turn ${turnNum}: "${msg}"${detailStr}`;

      if (totalChars + line.length + 1 > this.config.maxSummaryChars) {
        lines.push(`... (${this.frames.length - i} older turns omitted)`);
        break;
      }

      lines.push(line);
      totalChars += line.length + 1; // +1 for newline
    }

    return lines.join('\n');
  }

  // ==========================================================================
  // Persistence
  // ==========================================================================

  serialize(): string {
    return JSON.stringify(this.frames);
  }

  restore(serialized: string): void {
    try {
      const parsed = JSON.parse(serialized);

      if (!Array.isArray(parsed)) {
        logger.warn('[ContextStackImpl] Restore failed: not an array');
        return;
      }

      // Validate each frame
      const valid = parsed.filter((frame: unknown): frame is Phase2ContextFrame => {
        if (typeof frame !== 'object' || frame === null) return false;
        const f = frame as Record<string, unknown>;
        return (
          typeof f.turnId === 'string' &&
          typeof f.timestamp === 'number' &&
          typeof f.userMessage === 'string' &&
          typeof f.agentResponse === 'string' &&
          Array.isArray(f.toolCalls) &&
          Array.isArray(f.decisions) &&
          Array.isArray(f.memoryWrites)
        );
      });

      // Enforce maxFrames during restore
      this.frames = valid.length > this.config.maxFrames
        ? valid.slice(-this.config.maxFrames)
        : valid;

      logger.debug(`[ContextStackImpl] Restored ${this.frames.length} frames`);
    } catch {
      logger.warn('[ContextStackImpl] Restore failed: invalid JSON');
    }
  }

  // ==========================================================================
  // Static Frame Builder
  // ==========================================================================

  static createFrame(
    userMessage: string,
    agentResponse: string,
    options?: {
      toolCalls?: { name: string; args: unknown; result: unknown }[];
      decisions?: string[];
      memoryWrites?: string[];
    }
  ): Phase2ContextFrame {
    return {
      turnId: `turn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: Date.now(),
      userMessage,
      agentResponse,
      toolCalls: options?.toolCalls ?? [],
      decisions: options?.decisions ?? [],
      memoryWrites: options?.memoryWrites ?? [],
    };
  }
}
