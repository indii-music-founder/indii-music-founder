/**
 * Agent Execution Context - Phase 3: Architectural Improvements
 *
 * Provides isolated execution environments for agents with:
 * - State snapshots (copy-on-write)
 * - Transaction support (commit/rollback)
 * - Conflict detection
 * - Change tracking
 *
 * This prevents agents from interfering with each other's state during execution.
 */

import { useStore } from '@/core/store';
import type { StoreState } from '@/core/store';

export interface ExecutionContextOptions {
    userId?: string;
    projectId?: string;
    agentId: string;
    traceId: string;
}

export interface StateModification {
    key: keyof StoreState;
    oldValue: any;
    newValue: any;
    timestamp: number;
}

/**
 * AgentExecutionContext provides an isolated state environment for agent execution.
 * Changes are tracked and can be committed atomically or rolled back.
 */
export class AgentExecutionContext {
    private snapshot: Readonly<Partial<StoreState>>;
    private modifications: Map<keyof StoreState, any> = new Map();
    private changeHistory: StateModification[] = [];
    private readonly options: ExecutionContextOptions;
    private isCommitted = false;
    private isRolledBack = false;

    constructor(options: ExecutionContextOptions) {
        this.options = options;

        // Create immutable snapshot of current state
        const currentState = useStore.getState();
        this.snapshot = this.createSnapshot(currentState);
    }

    /**
     * Starts the execution context (architectural compatibility).
     * The snapshot is already taken in the constructor, so this is a no-op
     * but provided for consistency with modular transaction managers.
     */
    async start(): Promise<void> {
        return Promise.resolve();
    }

    /**
     * Create deep snapshot of relevant state
     * (Only snapshot what agents actually need to avoid memory bloat)
     */
    private createSnapshot(state: StoreState): Readonly<Partial<StoreState>> {
        const snapshot: any = {
            // App state
            currentModule: state.currentModule,
            currentProjectId: state.currentProjectId,
            projects: state.projects ? JSON.parse(JSON.stringify(state.projects)) : [],

            // Auth/Profile state
            user: state.user ? JSON.parse(JSON.stringify(state.user)) : null,
            userProfile: state.userProfile ? JSON.parse(JSON.stringify(state.userProfile)) : null,
            currentOrganizationId: state.currentOrganizationId,
            organizations: state.organizations ? JSON.parse(JSON.stringify(state.organizations)) : [],

            // Agent state
            agentHistory: state.agentHistory ? JSON.parse(JSON.stringify(state.agentHistory)) : [],
            agentMode: state.agentMode,
            chatChannel: state.chatChannel,

            // Creative state
            canvasImages: state.canvasImages ? JSON.parse(JSON.stringify(state.canvasImages)) : [],
            generatedHistory: state.generatedHistory ? JSON.parse(JSON.stringify(state.generatedHistory)) : [],

            // Finance state
            finance: state.finance ? JSON.parse(JSON.stringify(state.finance)) : undefined,

            // Workflow state
            nodes: state.nodes ? JSON.parse(JSON.stringify(state.nodes)) : [],
            edges: state.edges ? JSON.parse(JSON.stringify(state.edges)) : [],
        };

        return Object.freeze(snapshot);
    }

    /**
     * Get current state (snapshot + modifications)
     */
    getState<K extends keyof StoreState>(key: K): StoreState[K] {
        // Return modification if exists, otherwise snapshot
        if (this.modifications.has(key)) {
            return this.modifications.get(key) as StoreState[K];
        }

        return (this.snapshot as any)[key];
    }

    /**
     * Get full state object (for tools that need multiple keys)
     */
    getFullState(): Partial<StoreState> {
        const merged: any = { ...this.snapshot };

        // Apply modifications on top
        this.modifications.forEach((value, key) => {
            merged[key] = value;
        });

        return merged;
    }

    /**
     * Set state value (tracked as modification, not committed yet)
     */
    setState<K extends keyof StoreState>(key: K, value: StoreState[K]): void {
        if (this.isCommitted) {
            throw new Error('Cannot modify committed execution context');
        }
        if (this.isRolledBack) {
            throw new Error('Cannot modify rolled-back execution context');
        }

        const oldValue = this.getState(key);

        // Track modification
        this.modifications.set(key, value);

        // Record change history
        this.changeHistory.push({
            key,
            oldValue,
            newValue: value,
            timestamp: Date.now()
        });
    }

    /**
     * Batch state update
     */
    updateState(updates: Partial<StoreState>): void {
        Object.entries(updates).forEach(([key, value]) => {
            this.setState(key as keyof StoreState, value);
        });
    }

    /**
     * Commit all modifications to global state atomically
     */
    commit(): void {
        if (this.isCommitted) {
            console.warn('[ExecutionContext] Already committed');
            return;
        }
        if (this.isRolledBack) {
            throw new Error('Cannot commit rolled-back execution context');
        }

        const globalState = useStore.getState();

        // Check for conflicts (state changed since snapshot)
        const conflicts = this.detectConflicts(globalState);
        if (conflicts.length > 0) {
            console.warn(`[ExecutionContext] Conflicts detected: ${conflicts.join(', ')}`);
            // For now, log but proceed (last-write-wins)
            // Future: implement merge strategies
        }

        // Apply all modifications atomically
        const updates: any = {};
        this.modifications.forEach((value, key) => {
            updates[key] = value;
        });

        if (Object.keys(updates).length > 0) {
            useStore.setState(updates);
            console.log(`[ExecutionContext] Committed ${Object.keys(updates).length} modifications for agent ${this.options.agentId}`);
        }

        this.isCommitted = true;
    }

    /**
     * Rollback all modifications (discard changes)
     */
    rollback(): void {
        if (this.isCommitted) {
            throw new Error('Cannot rollback committed execution context');
        }
        if (this.isRolledBack) {
            console.warn('[ExecutionContext] Already rolled back');
            return;
        }

        console.log(`[ExecutionContext] Rolling back ${this.modifications.size} modifications for agent ${this.options.agentId}`);

        this.modifications.clear();
        this.changeHistory = [];
        this.isRolledBack = true;
    }

    /**
     * Detect conflicts between snapshot and current global state
     */
    private detectConflicts(currentState: StoreState): string[] {
        const conflicts: string[] = [];

        this.modifications.forEach((modifiedValue, key) => {
            const snapshotValue = (this.snapshot as any)[key];
            const currentValue = (currentState as any)[key];

            // If global state changed since snapshot, we have a conflict
            if (JSON.stringify(snapshotValue) !== JSON.stringify(currentValue)) {
                conflicts.push(key as string);
            }
        });

        return conflicts;
    }

    /**
     * Get change summary for logging/debugging
     */
    getChangeSummary(): string {
        if (this.modifications.size === 0) {
            return 'No modifications';
        }

        const summary = Array.from(this.modifications.keys())
            .map(key => {
                const val = this.modifications.get(key);
                let valStr: string;
                try {
                    valStr = JSON.stringify(val);
                } catch (e) {
                    valStr = `[Non-serializable: ${typeof val}]`;
                }

                // Truncate if too long to avoid flooding logs
                const truncated = valStr.length > 50
                    ? valStr.substring(0, 50) + '...'
                    : valStr;

                return `${String(key)}: ${truncated}`;
            })
            .join(', ');

        return `${this.modifications.size} changes: ${summary}`;
    }

    /**
     * Get change history for debugging
     */
    getChangeHistory(): StateModification[] {
        return [...this.changeHistory];
    }

    /**
     * Check if context has uncommitted changes
     */
    hasUncommittedChanges(): boolean {
        return this.modifications.size > 0 && !this.isCommitted;
    }

    /**
     * Get context metadata
     */
    getMetadata() {
        return {
            agentId: this.options.agentId,
            traceId: this.options.traceId,
            userId: this.options.userId,
            projectId: this.options.projectId,
            modificationsCount: this.modifications.size,
            isCommitted: this.isCommitted,
            isRolledBack: this.isRolledBack,
            changeHistory: this.changeHistory.length
        };
    }
}

/**
 * Factory for creating execution contexts
 */
export class ExecutionContextFactory {
    static create(options: ExecutionContextOptions): AgentExecutionContext {
        return new AgentExecutionContext(options);
    }

    /**
     * Create context from existing AgentContext
     */
    static fromAgentContext(agentContext: {
        userId?: string;
        projectId?: string;
        traceId?: string;
    }, agentId: string): AgentExecutionContext {
        return new AgentExecutionContext({
            userId: agentContext.userId,
            projectId: agentContext.projectId,
            agentId,
            traceId: agentContext.traceId || `trace-${Date.now()}`
        });
    }
}
