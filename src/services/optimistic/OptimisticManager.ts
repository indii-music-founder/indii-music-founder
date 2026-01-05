/**
 * Optimistic Update Manager
 *
 * Manages optimistic UI updates with automatic rollback on failure.
 * Enables optimistic user experience by assuming operations succeed and
 * rolling back only when they actually fail.
 */

interface OptimisticAction<T> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
  executeFn: () => Promise<any>;
  rollbackFn: () => Promise<void>;
  isComplete: boolean;
  error?: Error;
}

class OptimisticManager {
  private pendingActions: Map<string, OptimisticAction<any>> = new Map();
  private maxPendingActions = 100;

  /**
   * Execute an action optimistically
   * Returns the result, or rolls back on error
   */
  async execute<T>(
    actionId: string,
    actionType: string,
    payload: T,
    executeFn: () => Promise<any>,
    rollbackFn: () => Promise<void>
  ): Promise<any> {
    const action: OptimisticAction<T> = {
      id: actionId,
      type: actionType,
      payload,
      timestamp: Date.now(),
      executeFn,
      rollbackFn,
      isComplete: false
    };

    // Enforce max pending actions
    if (this.pendingActions.size >= this.maxPendingActions) {
      const oldestKey = this.pendingActions.keys().next().value;
      if (oldestKey) {
        this.pendingActions.delete(oldestKey);
      }
    }

    this.pendingActions.set(actionId, action);

    try {
      const result = await executeFn();
      action.isComplete = true;
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      action.error = err;

      try {
        await rollbackFn();
      } catch (rollbackError) {
        console.error('[OptimisticManager] Rollback failed:', rollbackError);
      }

      throw error;
    } finally {
      this.pendingActions.delete(actionId);
    }
  }

  /**
   * Get a pending action by ID
   */
  getPendingAction(actionId: string): OptimisticAction<any> | undefined {
    return this.pendingActions.get(actionId);
  }

  /**
   * Check if there are any pending actions
   */
  hasPendingActions(): boolean {
    return this.pendingActions.size > 0;
  }

  /**
   * Get the count of pending actions
   */
  getPendingCount(): number {
    return this.pendingActions.size;
  }

  /**
   * Get all pending actions
   */
  getAllPendingActions(): OptimisticAction<any>[] {
    return Array.from(this.pendingActions.values());
  }

  /**
   * Cancel a pending action (force rollback)
   */
  async cancelAction(actionId: string): Promise<void> {
    const action = this.pendingActions.get(actionId);
    if (action && !action.isComplete) {
      this.pendingActions.delete(actionId);
      try {
        await action.rollbackFn();
      } catch (error) {
        console.error('[OptimisticManager] Cancel rollback failed:', error);
      }
    }
  }

  /**
   * Cancel all pending actions
   */
  async cancelAllActions(): Promise<void> {
    const promises = Array.from(this.pendingActions.keys()).map(id =>
      this.cancelAction(id)
    );
    await Promise.all(promises);
  }

  /**
   * Clean up old pending actions (older than 5 minutes)
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [id, action] of this.pendingActions.entries()) {
      if (now - action.timestamp > maxAge) {
        this.pendingActions.delete(id);
      }
    }
  }
}

export const optimisticManager = new OptimisticManager();

// Auto-cleanup every minute
setInterval(() => {
  optimisticManager.cleanup();
}, 60 * 1000);
