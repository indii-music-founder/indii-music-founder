import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { CanonicalArtistEntityIdSchema } from '@indii/shared';

const AgentId = z.enum(['brand', 'creative', 'devops', 'finance', 'marketing', 'publicist', 'social']);
const Step = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  agentId: AgentId,
  prompt: z.string().trim().min(1).max(4_000),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']),
}).strict();
const Edge = z.object({
  from: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  to: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  label: z.string().max(160).optional(),
}).strict();
const CreatePayload = z.object({
  workflowId: z.enum(['CAMPAIGN_LAUNCH', 'AI_MERCH_DROP', 'SECURITY_AUDIT', 'TOUR_PLANNING', 'INDII_GROWTH_PROTOCOL']),
  steps: z.array(Step).min(1).max(4),
  edges: z.array(Edge).max(8),
  sessionId: z.string().max(128).optional(),
  artistEntityId: CanonicalArtistEntityIdSchema.optional(),
}).strict();

type CreatePayload = z.infer<typeof CreatePayload>;

export function validateWorkflowExecutionInput(value: unknown): CreatePayload {
  const parsed = CreatePayload.safeParse(value);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Workflow definition is invalid or exceeds the execution limits.');

  const ids = new Set(parsed.data.steps.map(step => step.id));
  if (ids.size !== parsed.data.steps.length) throw new HttpsError('invalid-argument', 'Workflow step IDs must be unique.');
  for (const edge of parsed.data.edges) {
    if (edge.from === edge.to || !ids.has(edge.from) || !ids.has(edge.to)) {
      throw new HttpsError('invalid-argument', 'Workflow edges must connect distinct steps in this workflow.');
    }
  }

  // Reject cycles before persisting a job that the server runner could never finish.
  const outgoing = new Map<string, string[]>();
  for (const edge of parsed.data.edges) outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    for (const next of outgoing.get(id) ?? []) if (!visit(next)) return false;
    visiting.delete(id);
    visited.add(id);
    return true;
  };
  if ([...ids].some(id => !visit(id))) throw new HttpsError('invalid-argument', 'Workflow dependencies must be acyclic.');
  return parsed.data;
}

export const createWorkflowExecution = onCall(
  { region: 'us-central1', enforceAppCheck: true, memory: '512MiB' },
  async request => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to start a workflow.');
    const input = validateWorkflowExecutionInput(request.data);
    const userId = request.auth.uid;
    const db = admin.firestore();
    const now = Date.now();
    const id = randomUUID();
    const ref = db.collection('users').doc(userId).collection('workflowExecutions').doc(id);
    const steps = Object.fromEntries(input.steps.map(step => [step.id, {
      stepId: step.id,
      agentId: step.agentId,
      prompt: step.prompt,
      status: 'PLANNED',
      idempotencyKey: randomUUID(),
    }]));

    await db.runTransaction(async tx => {
      const active = await tx.get(
        db.collection('users').doc(userId).collection('workflowExecutions')
          .where('status', 'in', ['PLANNED', 'EXECUTING', 'AWAITING_HUMAN', 'AWAITING_EVALUATION']).limit(1)
      );
      if (!active.empty) throw new HttpsError('resource-exhausted', 'Finish or cancel the active workflow before starting another.');
      tx.create(ref, {
        id,
        workflowId: input.workflowId,
        ...(input.artistEntityId ? { artistEntityId: input.artistEntityId } : {}),
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        userId,
        status: 'PLANNED',
        steps,
        edges: input.edges,
        createdAt: now,
        updatedAt: now,
      });
    });
    return { executionId: id, status: 'PLANNED' as const };
  },
);

const ManagePayload = z.object({
  executionId: z.string().uuid(),
  action: z.enum(['cancel', 'resume']),
}).strict();

export const manageWorkflowExecution = onCall(
  { region: 'us-central1', enforceAppCheck: true, memory: '512MiB' },
  async request => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to manage a workflow.');
    const parsed = ManagePayload.safeParse(request.data);
    if (!parsed.success) throw new HttpsError('invalid-argument', 'Workflow action is invalid.');
    const { executionId, action } = parsed.data;
    const ref = admin.firestore().collection('users').doc(request.auth.uid).collection('workflowExecutions').doc(executionId);
    await admin.firestore().runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpsError('not-found', 'Workflow execution was not found.');
      const execution = snap.data() as { status?: string; steps?: Record<string, { status?: string }> };
      const now = Date.now();
      if (action === 'cancel') {
        if (!['PLANNED', 'EXECUTING', 'AWAITING_HUMAN', 'AWAITING_EVALUATION'].includes(execution.status ?? '')) {
          throw new HttpsError('failed-precondition', 'Only an active workflow can be cancelled.');
        }
        const update: Record<string, unknown> = { status: 'CANCELLED', updatedAt: now };
        for (const [stepId, step] of Object.entries(execution.steps ?? {})) {
          if (['PLANNED', 'EXECUTING_GENERATION', 'AWAITING_HUMAN', 'AWAITING_EVALUATION'].includes(step.status ?? '')) {
            update[`steps.${stepId}.status`] = 'CANCELLED';
            update[`steps.${stepId}.completedAt`] = now;
          }
        }
        tx.update(ref, update);
        return;
      }
      if (execution.status !== 'FAILED') throw new HttpsError('failed-precondition', 'Only a failed workflow can be resumed.');
      const failed = Object.entries(execution.steps ?? {}).filter(([, step]) => step.status === 'FAILED');
      if (failed.length === 0) throw new HttpsError('failed-precondition', 'This workflow has no failed step to retry.');
      const update: Record<string, unknown> = { status: 'PLANNED', updatedAt: now };
      for (const [stepId] of failed) {
        update[`steps.${stepId}.status`] = 'PLANNED';
        update[`steps.${stepId}.error`] = admin.firestore.FieldValue.delete();
        update[`steps.${stepId}.result`] = admin.firestore.FieldValue.delete();
        update[`steps.${stepId}.completedAt`] = admin.firestore.FieldValue.delete();
        update[`steps.${stepId}.idempotencyKey`] = randomUUID();
      }
      tx.update(ref, update);
    });
    return { executionId, status: action === 'cancel' ? 'CANCELLED' as const : 'PLANNED' as const };
  },
);
