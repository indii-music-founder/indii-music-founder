import { httpsCallable } from 'firebase/functions';
import { FirestoreService } from '../FirestoreService';
import { logger } from '@/utils/logger';
import { auth, functions } from '@/services/firebase';
import type { WorkflowExecution, WorkflowStep, WorkflowEdge } from './types';
import {
    WorkflowExecutionSchema,
    WorkflowExecutionStatusEnum,
    CanonicalArtistEntityIdSchema,
    predictNextWorkflows,
    type WorkflowPredictionReport,
} from '@indii/shared';

type WorkflowActionResponse = { executionId: string; status: string };

class WorkflowStateServiceImpl {
    private getService(userId: string): FirestoreService<WorkflowExecution> {
        return new FirestoreService<WorkflowExecution>(`users/${userId}/workflowExecutions`);
    }

    private normalizeExecution(execution: WorkflowExecution): WorkflowExecution {
        return WorkflowExecutionSchema.parse({ edges: [], ...execution, steps: execution.steps || {} }) as WorkflowExecution;
    }

    private requireOwner(userId: string): void {
        if (!userId || auth.currentUser?.uid !== userId) throw new Error('Sign in as the workflow owner to continue.');
    }

    async createExecution(
        userId: string,
        workflowId: string,
        steps: WorkflowStep[],
        edges: WorkflowEdge[],
        sessionId?: string,
        artistEntityId?: string,
    ): Promise<WorkflowExecution> {
        this.requireOwner(userId);
        const parsedArtistId = artistEntityId ? CanonicalArtistEntityIdSchema.safeParse(artistEntityId) : undefined;
        if (parsedArtistId && !parsedArtistId.success) throw new Error('Workflow artist context must be a canonical artist entity ID.');
        const create = httpsCallable<{
            workflowId: string;
            steps: WorkflowStep[];
            edges: Array<Pick<WorkflowEdge, 'from' | 'to' | 'label'>>;
            sessionId?: string;
            artistEntityId?: string;
        }, { executionId: string; status: string }>(functions, 'createWorkflowExecution');
        const response = await create({
            workflowId,
            steps,
            edges: edges.map(({ from, to, label }) => ({ from, to, ...(label ? { label } : {}) })),
            ...(sessionId ? { sessionId } : {}),
            ...(parsedArtistId?.success ? { artistEntityId: parsedArtistId.data } : {}),
        });
        const execution = await this.getExecution(userId, response.data.executionId);
        if (!execution) throw new Error('Workflow was accepted, but its persisted state is not yet readable. Refresh to check its status.');
        logger.info(`[WorkflowState] Server created execution ${execution.id} for workflow '${workflowId}'`);
        return execution;
    }

    async getExecutionsByUser(userId: string): Promise<WorkflowExecution[]> {
        this.requireOwner(userId);
        return (await this.getService(userId).list()).map(execution => this.normalizeExecution(execution));
    }

    async getNextWorkflowPrediction(userId: string, artistEntityId: string): Promise<WorkflowPredictionReport | null> {
        const canonicalArtistId = CanonicalArtistEntityIdSchema.safeParse(artistEntityId);
        if (!canonicalArtistId.success || auth.currentUser?.uid !== userId) return null;
        const executions = await this.getExecutionsByUser(userId);
        return predictNextWorkflows({ userId, artistEntityId: canonicalArtistId.data, executions, evaluatedAt: new Date().toISOString() });
    }

    async getExecution(userId: string, executionId: string): Promise<WorkflowExecution | null> {
        this.requireOwner(userId);
        const execution = await this.getService(userId).get(executionId);
        return execution ? this.normalizeExecution(execution) : null;
    }

    async getResumableExecutions(userId: string): Promise<WorkflowExecution[]> {
        const executions = await this.getExecutionsByUser(userId);
        const resumable: string[] = [
            WorkflowExecutionStatusEnum.enum.PLANNED,
            WorkflowExecutionStatusEnum.enum.EXECUTING,
            WorkflowExecutionStatusEnum.enum.FAILED,
        ];
        return executions.filter(execution => resumable.includes(execution.status));
    }

    async cancelExecution(userId: string, executionId: string): Promise<void> {
        await this.manageExecution(userId, executionId, 'cancel');
        logger.info(`[WorkflowState] Execution ${executionId} cancellation requested`);
    }

    async resumeExecution(userId: string, executionId: string): Promise<void> {
        await this.manageExecution(userId, executionId, 'resume');
        logger.info(`[WorkflowState] Execution ${executionId} resume requested`);
    }

    private async manageExecution(userId: string, executionId: string, action: 'cancel' | 'resume'): Promise<WorkflowActionResponse> {
        this.requireOwner(userId);
        const manage = httpsCallable<{ executionId: string; action: 'cancel' | 'resume' }, WorkflowActionResponse>(functions, 'manageWorkflowExecution');
        const response = await manage({ executionId, action });
        return response.data;
    }
}

export const workflowStateService = new WorkflowStateServiceImpl();
