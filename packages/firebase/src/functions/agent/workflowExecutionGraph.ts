export interface PlannedWorkflowStep {
    stepId: string;
    status: string;
    agentId?: string;
    prompt?: string;
    idempotencyKey?: string;
}

export interface WorkflowDependencyEdge {
    from: string;
    to: string;
}

export interface WorkflowExecutionClaim {
    status: string;
    steps: Record<string, { status: string; idempotencyKey: string }>;
}

export function isCurrentWorkflowStepClaim(execution: WorkflowExecutionClaim, stepId: string, idempotencyKey: string): boolean {
    const step = execution.steps[stepId];
    return execution.status === 'EXECUTING' && step?.status === 'EXECUTING_GENERATION' && step.idempotencyKey === idempotencyKey;
}

export function findReadyWorkflowStep(
    steps: Record<string, PlannedWorkflowStep>,
    edges: WorkflowDependencyEdge[],
): PlannedWorkflowStep | undefined {
    const terminal = new Set(['STEP_COMPLETE', 'SKIPPED']);
    return Object.values(steps).find(step => step.status === 'PLANNED' && edges
        .filter(edge => edge.to === step.stepId)
        .every(edge => terminal.has(steps[edge.from]?.status ?? '')));
}

export function hasActiveWorkflowStep(steps: PlannedWorkflowStep[]): boolean {
    return steps.some(step => ['EXECUTING_GENERATION', 'AWAITING_HUMAN', 'AWAITING_EVALUATION'].includes(step.status));
}
