import { WorkflowExecutionSchema, type WorkflowExecution } from '@indii/shared';

export function parseWorkflowHistoryRecord(ownerId: string, projectId: string, documentId: string, input: unknown): WorkflowExecution {
    const execution = WorkflowExecutionSchema.parse(input);
    if (execution.userId !== ownerId || execution.sessionId !== projectId || execution.id !== documentId) {
        throw new Error('Workflow history does not match its owner, project, or document.');
    }
    return execution;
}

export function getWorkflowHistorySummary(execution: WorkflowExecution) {
    const steps = Object.values(execution.steps);
    const finished = steps.filter(step => step.status === 'STEP_COMPLETE' || step.status === 'SKIPPED').length;
    return {
        total: steps.length,
        finished,
        completionEvidenceConsistent: execution.status !== 'COMPLETED' || (steps.length > 0 && finished === steps.length),
        canCancel: ['PLANNED', 'EXECUTING', 'AWAITING_HUMAN', 'AWAITING_EVALUATION'].includes(execution.status),
        canResume: execution.status === 'FAILED' && steps.some(step => step.status === 'FAILED'),
    };
}
