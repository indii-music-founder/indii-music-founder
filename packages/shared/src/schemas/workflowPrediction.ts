import { z } from 'zod';
import { CanonicalArtistEntityIdSchema, WorkflowExecutionSchema } from './workflowState.js';

const IdSchema = z.string().trim().min(1).max(256);
const IsoDateTimeSchema = z.string().datetime();

export const WorkflowPredictionInputSchema = z.object({
  userId: IdSchema,
  artistEntityId: CanonicalArtistEntityIdSchema,
  executions: z.array(WorkflowExecutionSchema).max(5_000),
  evaluatedAt: IsoDateTimeSchema,
}).strict().superRefine((input, ctx) => {
  const ids = new Set<string>();
  input.executions.forEach((execution, index) => {
    if (ids.has(execution.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['executions', index, 'id'], message: 'Workflow execution IDs must be unique in one history snapshot.' });
    }
    ids.add(execution.id);
  });
});
export type WorkflowPredictionInput = z.infer<typeof WorkflowPredictionInputSchema>;

export const WorkflowPredictionSchema = z.object({
  workflowId: IdSchema,
  followsWorkflowId: IdSchema,
  supportCount: z.number().int().min(2),
  observedTransitionCount: z.number().int().min(2),
  observedRate: z.number().min(0).max(1),
  supportingExecutionIds: z.array(IdSchema).min(2).max(10),
}).strict();
export type WorkflowPrediction = z.infer<typeof WorkflowPredictionSchema>;

export const WorkflowPredictionReportSchema = z.object({
  schemaVersion: z.literal('workflow-prediction.v1'),
  scope: z.literal('CURRENT_ARTIST_CONTEXT_ONLY'),
  historyEvidence: z.literal('PERSISTED_COMPLETED_WORKFLOWS'),
  latestCompletedExecutionId: IdSchema,
  predictions: z.array(WorkflowPredictionSchema).max(5),
  evaluatedAt: IsoDateTimeSchema,
  advisoryOnly: z.literal(true),
  executionAuthorized: z.literal(false),
}).strict();
export type WorkflowPredictionReport = z.infer<typeof WorkflowPredictionReportSchema>;

type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;

function isVerifiedCompletion(execution: WorkflowExecution): boolean {
  const steps = Object.values(execution.steps);
  return execution.status === 'COMPLETED'
    && steps.length > 0
    && steps.every(step => step.status === 'STEP_COMPLETE'
      && typeof step.completedAt === 'number'
      && step.completedAt >= execution.createdAt
      && step.completedAt <= execution.updatedAt)
    && execution.updatedAt >= execution.createdAt;
}

/**
 * Suggests what may come next using only this user's persisted, fully
 * completed workflow records. It never starts a workflow or treats a pattern
 * as a factual, legal, rights, or business assertion.
 */
export function predictNextWorkflows(input: WorkflowPredictionInput): WorkflowPredictionReport | null {
  const parsed = WorkflowPredictionInputSchema.parse(input);
  const chronological = [...parsed.executions]
    .filter(execution => execution.userId === parsed.userId && execution.artistEntityId === parsed.artistEntityId)
    .sort((left, right) => left.createdAt - right.createdAt || left.updatedAt - right.updatedAt || left.id.localeCompare(right.id));
  const latest = chronological.at(-1);
  if (!latest || !isVerifiedCompletion(latest)) return null;

  const transitions = new Map<string, Map<string, string[]>>();
  for (let index = 0; index < chronological.length - 1; index += 1) {
    const previous = chronological[index]!;
    const next = chronological[index + 1]!;
    if (!isVerifiedCompletion(previous) || !isVerifiedCompletion(next) || previous.updatedAt > next.createdAt) continue;
    const nextByWorkflow = transitions.get(previous.workflowId) ?? new Map<string, string[]>();
    const supportingIds = nextByWorkflow.get(next.workflowId) ?? [];
    supportingIds.push(previous.id, next.id);
    nextByWorkflow.set(next.workflowId, supportingIds);
    transitions.set(previous.workflowId, nextByWorkflow);
  }

  const observed = transitions.get(latest.workflowId);
  if (!observed) return null;
  const observedTransitionCount = [...observed.values()].reduce((total, ids) => total + ids.length / 2, 0);
  const predictions = [...observed.entries()]
    .map(([workflowId, ids]) => ({
      workflowId,
      followsWorkflowId: latest.workflowId,
      supportCount: ids.length / 2,
      observedTransitionCount,
      observedRate: (ids.length / 2) / observedTransitionCount,
      supportingExecutionIds: [...new Set(ids)].slice(-10),
    }))
    .filter(prediction => prediction.supportCount >= 2)
    .sort((left, right) => right.supportCount - left.supportCount || left.workflowId.localeCompare(right.workflowId))
    .slice(0, 5)
    .map(prediction => WorkflowPredictionSchema.parse(prediction));
  if (predictions.length === 0) return null;

  return WorkflowPredictionReportSchema.parse({
    schemaVersion: 'workflow-prediction.v1',
    scope: 'CURRENT_ARTIST_CONTEXT_ONLY',
    historyEvidence: 'PERSISTED_COMPLETED_WORKFLOWS',
    latestCompletedExecutionId: latest.id,
    predictions,
    evaluatedAt: parsed.evaluatedAt,
    advisoryOnly: true,
    executionAuthorized: false,
  });
}
