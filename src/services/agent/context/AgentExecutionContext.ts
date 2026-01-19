import { AgentContext } from '../types';
import { TransactionManager } from './TransactionManager';

/**
 * Encapsulates the execution context for an agent, including
 * transaction management and state isolation.
 */
export class AgentExecutionContext {
    public readonly id: string;
    private transactionManager: TransactionManager;
    private activeTransactionId: string | null = null;
    public readonly innerContext: AgentContext;

    constructor(
        context: AgentContext,
        transactionManager?: TransactionManager
    ) {
        this.innerContext = context;
        this.id = context.traceId || crypto.randomUUID();
        this.transactionManager = transactionManager || new TransactionManager();
    }

    /**
     * Starts the execution context (begins transaction).
     */
    async start() {
        if (this.activeTransactionId) return;
        this.activeTransactionId = await this.transactionManager.beginTransaction(this.innerContext);
    }

    /**
     * Commits the changes made during execution.
     */
    async commit() {
        if (!this.activeTransactionId) return;
        await this.transactionManager.commit(this.activeTransactionId);
        this.activeTransactionId = null;
    }

    /**
     * Rolls back changes made during execution.
     */
    async rollback() {
        if (!this.activeTransactionId) return;
        await this.transactionManager.rollback(this.activeTransactionId);
        this.activeTransactionId = null;
    }
}
