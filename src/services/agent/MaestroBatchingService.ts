/* eslint-disable @typescript-eslint/no-explicit-any -- Service layer uses dynamic types for external API responses */
import { logger } from '@/utils/logger';
import { RequestBatcher } from '@/utils/RequestBatcher';
import { useStore } from '@/core/store';

export type TaskPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface BatchedTask {
    id: string;
    description: string;
    agentId: string;
    priority: TaskPriority;
    params: any;
    context?: any;
    traceId?: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    result?: any;
    error?: string;
}

export class MaestroBatchingService {
    private batcher: RequestBatcher<BatchedTask, any>;

    constructor() {
        this.batcher = new RequestBatcher(
            (tasks) => this.processBatch(tasks),
            { maxBatchSize: 5, maxWaitMs: 300 }
        );
    }

    /**
     * Orchestrate a task execution via the batcher.
     */
    async executeTask(task: Omit<BatchedTask, 'id' | 'status'>): Promise<any> {
        const id = crypto.randomUUID();
        const fullTask: BatchedTask = {
            ...task,
            id,
            status: 'pending'
        };

        // Add to global state for UI visibility
        useStore.getState().addBatchTask(fullTask);

        try {
            const result = await this.batcher.add(fullTask);
            useStore.getState().updateBatchTask(id, { status: 'completed', result });
            return result;
        } catch (error: unknown) {
            useStore.getState().updateBatchTask(id, { status: 'error', error: error instanceof Error ? error.message : String(error) });
            throw error;
        }
    }

    /**
     * Processes a collected batch of tasks.
     * Sorts by priority before execution.
     */
    private async processBatch(tasks: BatchedTask[]): Promise<any[]> {
        // 1. Sort by priority: URGENT (0) > HIGH (1) > MEDIUM (2) > LOW (3)
        const priorityMap: Record<TaskPriority, number> = {
            'URGENT': 0,
            'HIGH': 1,
            'MEDIUM': 2,
            'LOW': 3
        };

        const sortedTasks = [...tasks].sort((a, b) =>
            priorityMap[a.priority] - priorityMap[b.priority]
        );

        // Update status to processing in state
        sortedTasks.forEach(t => {
            useStore.getState().updateBatchTask(t.id, { status: 'processing' });
        });

        // 2. Execute tasks
        // Execute in parallel but store results mapped by ID so we return them in the exact
        // original `tasks` request order. This satisfies RequestBatcher's index assumption.
        const resultsMap = new Map<string, any>();
        await Promise.all(sortedTasks.map(async (t) => {
            const result = await this.executeIndividualTask(t);
            resultsMap.set(t.id, result);
        }));

        return tasks.map(t => resultsMap.get(t.id));
    }

    private async executeIndividualTask(task: BatchedTask): Promise<any> {
        logger.debug(`[Maestro] Executing task ${task.id} for agent ${task.agentId} (Priority: ${task.priority})`);

        try {
            // Dynamic import to avoid circular dependency with AgentService
            const { agentService } = await import('./AgentService');

            const result = await agentService.runAgent(
                task.agentId,
                task.description,
                task.context,
                task.traceId
            );

            return {
                success: true,
                message: result.text,
                data: { taskId: task.id, thoughtSignature: result.thoughtSignature }
            };
        } catch (error: unknown) {
            logger.error(`[Maestro] Task ${task.id} failed:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                data: { taskId: task.id }
            };
        }
    }

    /**
     * Orchestrate multiple tasks as a single logical batch.
     */
    async executeBatch(tasks: Omit<BatchedTask, 'id' | 'status'>[]): Promise<any[]> {
        return Promise.all(tasks.map(t => this.executeTask(t)));
    }
}

export const maestroBatchingService = new MaestroBatchingService();
