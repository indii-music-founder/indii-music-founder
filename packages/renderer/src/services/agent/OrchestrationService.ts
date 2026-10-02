import type { AgentContext } from './types';
import { WORKFLOW_REGISTRY } from './WorkflowRegistry';
import { workflowStateService } from './WorkflowStateService';
import { WorkflowExecutionStatusEnum } from '@indii/shared';
import { logger } from '@/utils/logger';

export interface WorkflowExecutionResult {
    executionId: string;
    report: string;
    completed: boolean;
}

/** Starts server-owned workflow jobs and reports persisted status without running steps in the renderer. */
export class OrchestrationService {
    async executeWorkflow(workflowId: string, context: AgentContext): Promise<string> {
        return (await this.executeWorkflowWithStatus(workflowId, context)).report;
    }

    async executeWorkflowWithStatus(workflowId: string, context: AgentContext): Promise<WorkflowExecutionResult> {
        const workflow = WORKFLOW_REGISTRY[workflowId];
        if (!workflow) throw new Error(`Workflow ${workflowId} not found in registry.`);
        if (!context.userId) throw new Error('userId is required for workflow execution.');

        const execution = await workflowStateService.createExecution(
            context.userId,
            workflowId,
            workflow.steps,
            workflow.edges,
            context.projectId,
            context.userProfile?.artistContext?.artistEntityId ?? context.userProfile?.artistEntityId,
        );
        logger.info(`[Orchestration] Workflow ${workflowId} was accepted by the server as ${execution.id}`);
        return {
            executionId: execution.id,
            report: `Workflow ${workflow.name} was queued as ${execution.id}. Its server-owned execution status will appear when the persisted record updates.`,
            completed: execution.status === WorkflowExecutionStatusEnum.enum.COMPLETED,
        };
    }

    async resumeWorkflow(executionId: string, context: AgentContext): Promise<string> {
        if (!context.userId) throw new Error('userId is required for workflow resumption.');
        const execution = await workflowStateService.getExecution(context.userId, executionId);
        if (!execution) throw new Error(`Execution ${executionId} not found.`);
        if (execution.status === WorkflowExecutionStatusEnum.enum.COMPLETED || execution.status === WorkflowExecutionStatusEnum.enum.CANCELLED) {
            return `Workflow ${executionId} is already ${execution.status}. No steps to resume.`;
        }
        if (execution.status !== WorkflowExecutionStatusEnum.enum.FAILED) {
            return `Workflow ${executionId} is already active (${execution.status}). Check the persisted state for progress.`;
        }
        await workflowStateService.resumeExecution(context.userId, executionId);
        return `Resume requested for workflow ${executionId}. Check the persisted execution status for progress.`;
    }

    async executeOrchestratedWorkflow(intent: string, context: AgentContext): Promise<string | null> {
        const lower = intent.toLowerCase();
        if (lower.includes('launch') && (lower.includes('campaign') || lower.includes('release'))) {
            if (!context.projectId) throw new Error('A project must be active to launch a campaign.');
            return this.executeWorkflow('CAMPAIGN_LAUNCH', context);
        }
        if (lower.includes('merch') && (lower.includes('drop') || lower.includes('collection'))) {
            if (!context.projectId) throw new Error('A project must be active for a merch drop.');
            return this.executeWorkflow('AI_MERCH_DROP', context);
        }
        if (lower.includes('growth protocol') || (lower.includes('28-day') && lower.includes('frontloaded')) || lower.includes('deploy protocol')) {
            if (!context.projectId) throw new Error('A project must be active to launch the Growth Protocol.');
            return this.executeWorkflow('INDII_GROWTH_PROTOCOL', context);
        }
        return null;
    }
}

export const orchestrationService = new OrchestrationService();
