/**
 * Tool Execution Context - Phase 3: Architectural Improvements
 *
 * Provides isolated store access for tools during agent execution.
 * Tools interact with this context instead of global store directly.
 *
 * Benefits:
 * - Tools cannot corrupt global state during execution
 * - Changes are transaction-based (commit/rollback)
 * - Better debugging and change tracking
 */

import type { AgentExecutionContext } from './AgentExecutionContext';
import type { StoreState } from '@/core/store';

/**
 * Wrapper that provides store-like interface to tools
 * but routes through ExecutionContext for isolation
 */
export class ToolExecutionContext {
    constructor(private executionContext: AgentExecutionContext) {}

    /**
     * Get state (routes through execution context)
     */
    getState(): Partial<StoreState> {
        return this.executionContext.getFullState();
    }

    /**
     * Set state (routes through execution context, not committed yet)
     */
    setState(updates: Partial<StoreState>): void {
        this.executionContext.updateState(updates);
    }

    /**
     * Helper: Get specific state value
     */
    get<K extends keyof StoreState>(key: K): StoreState[K] | undefined {
        return this.executionContext.getState(key);
    }

    /**
     * Helper: Set specific state value
     */
    set<K extends keyof StoreState>(key: K, value: StoreState[K]): void {
        this.executionContext.setState(key, value);
    }

    /**
     * Check if tool has made modifications
     */
    hasChanges(): boolean {
        return this.executionContext.hasUncommittedChanges();
    }

    /**
     * Get summary of changes for logging
     */
    getChangeSummary(): string {
        return this.executionContext.getChangeSummary();
    }
}

/**
 * Type for tools that accept execution context
 */
export type ContextAwareTool<TArgs = any, TResult = any> = (
    args: TArgs,
    context: ToolExecutionContext
) => Promise<TResult>;

/**
 * Wrapper to adapt legacy tools (that use useStore directly) to execution context
 */
export function adaptLegacyTool<TArgs = any, TResult = any>(
    legacyTool: (args: TArgs) => Promise<TResult>
): ContextAwareTool<TArgs, TResult> {
    return async (args: TArgs, context: ToolExecutionContext) => {
        // Legacy tool will use useStore.getState() directly
        // This is a transitional adapter until all tools are migrated
        return await legacyTool(args);
    };
}

/**
 * Create a tool that's context-aware
 * This is the preferred way to create new tools
 */
export function createContextAwareTool<TArgs = any, TResult = any>(
    implementation: (args: TArgs, ctx: ToolExecutionContext) => Promise<TResult>
): ContextAwareTool<TArgs, TResult> {
    return implementation;
}
