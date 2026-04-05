import { StateManager } from './StateManager';
import { AgentContext } from '../types';

/**
 * Manages transactions for agent execution.
 * Allows begin, commit, and rollback operations.
 */
export class TransactionManager {
    private stateManager = new StateManager();

    /**
     * Begins a transaction by capturing the current state.
     * @param context Current agent context
     * @returns The transaction ID
     */
    async beginTransaction(context: AgentContext): Promise<string> {
        const txId = `tx-${context.traceId || crypto.randomUUID()}`;
        // Capture critical slices that agents might modify
        // We can expand this list as needed.
        // For now, capturing everything is safer for generic agents.
        await this.stateManager.captureSnapshot(txId);
        return txId;
    }

    async commit(txId: string) {
        this.stateManager.discardSnapshot(txId);
    }

    async rollback(txId: string) {
        await this.stateManager.restoreSnapshot(txId);
    }
}
