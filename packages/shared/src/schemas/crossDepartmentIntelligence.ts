import { z } from 'zod';
import {
  MusicDomainEventSchema,
  MusicEventEntityReferenceSchema,
  MusicDomainEventTypeSchema,
  type MusicDomainEvent,
  type MusicDomainEventType,
} from './musicEvent.js';
import { ProvenanceSchema } from './musicEntity.js';

const IdSchema = z.string().trim().min(1).max(300);
const IsoDateTimeSchema = z.string().datetime();

export const CrossDepartmentSchema = z.enum([
  'distribution',
  'publishing',
  'rights',
  'finance',
  'marketing',
  'analytics',
  'creative',
  'video',
]);
export type CrossDepartment = z.infer<typeof CrossDepartmentSchema>;

/**
 * Minimal review pointer for a department to re-evaluate its own canonical
 * state. It deliberately excludes event details, evidence, and related entity
 * payloads: consumers must resolve those from authorized canonical services.
 */
export const DepartmentReviewRequestSchema = z.object({
  requestId: IdSchema,
  department: CrossDepartmentSchema,
  eventId: IdSchema,
  eventType: MusicDomainEventTypeSchema,
  subject: MusicEventEntityReferenceSchema,
  occurredAt: IsoDateTimeSchema,
  recordedAt: IsoDateTimeSchema,
  sourceProvenanceState: ProvenanceSchema.shape.state,
  requiresHumanReview: z.literal(true),
  executionAuthorized: z.literal(false),
}).strict();
export type DepartmentReviewRequest = z.infer<typeof DepartmentReviewRequestSchema>;

export const CrossDepartmentReviewPlanSchema = z.object({
  schemaVersion: z.literal('cross-department-review-plan.v1'),
  sourceEventId: IdSchema,
  routingBasis: z.literal('STATIC_EVENT_TYPE_MAP'),
  requests: z.array(DepartmentReviewRequestSchema).max(8),
  requiresHumanReview: z.literal(true),
  executionAuthorized: z.literal(false),
}).strict().superRefine((plan, ctx) => {
  const requestIds = plan.requests.map(request => request.requestId);
  if (new Set(requestIds).size !== requestIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['requests'], message: 'Department review request IDs must be unique.' });
  }
  const departments = plan.requests.map(request => request.department);
  if (new Set(departments).size !== departments.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['requests'], message: 'An event can route to each department at most once.' });
  }
  if (plan.requests.some(request => request.eventId !== plan.sourceEventId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['requests'], message: 'Every request must point to the plan source event.' });
  }
});
export type CrossDepartmentReviewPlan = z.infer<typeof CrossDepartmentReviewPlanSchema>;

/**
 * Explicit deterministic Phase 15 route map. This produces review pointers
 * only; it does not enqueue/persist them, dispatch events, copy sensitive
 * details, mutate department state, or authorize a workflow.
 */
export const CROSS_DEPARTMENT_EVENT_ROUTES: Record<MusicDomainEventType, readonly CrossDepartment[]> = {
  'recording.uploaded': ['creative', 'distribution', 'publishing', 'rights', 'video'],
  'release.planned': ['creative', 'distribution', 'publishing', 'rights', 'finance', 'marketing', 'analytics', 'video'],
  'release.live': ['distribution', 'publishing', 'rights', 'finance', 'marketing', 'analytics', 'video'],
  'video.ready_for_tiktok': ['video', 'marketing', 'distribution', 'analytics'],
  'video.ready_for_youtube': ['video', 'marketing', 'distribution', 'analytics'],
  'performance.planned': ['creative', 'rights', 'finance', 'analytics'],
  'satellite_play.detected': ['rights', 'finance', 'analytics'],
  'claim.received': ['rights', 'finance', 'publishing', 'distribution'],
  'claim.status_changed': ['rights', 'finance', 'publishing', 'distribution'],
  'registration.confirmed': ['publishing', 'rights', 'finance', 'analytics'],
  'registration.status_changed': ['publishing', 'rights', 'finance', 'analytics'],
  'delivery.status_changed': ['distribution', 'marketing', 'finance', 'analytics'],
  'usage.reported': ['analytics', 'finance', 'rights', 'marketing', 'publishing'],
  'platform.connection_changed': ['distribution', 'marketing', 'analytics'],
  'catalog.state_changed': ['creative', 'distribution', 'publishing', 'rights', 'marketing', 'video'],
  'identity.conflict_detected': ['publishing', 'rights', 'finance', 'distribution', 'creative'],
  'catalog.migration.started': ['creative', 'distribution', 'publishing', 'rights', 'finance', 'marketing', 'analytics', 'video'],
  'catalog.migration.completed': ['creative', 'distribution', 'publishing', 'rights', 'finance', 'marketing', 'analytics', 'video'],
};

export function createCrossDepartmentReviewPlan(event: MusicDomainEvent): CrossDepartmentReviewPlan {
  const parsedEvent = MusicDomainEventSchema.parse(event);
  const departments = CROSS_DEPARTMENT_EVENT_ROUTES[parsedEvent.eventType];
  return CrossDepartmentReviewPlanSchema.parse({
    schemaVersion: 'cross-department-review-plan.v1',
    sourceEventId: parsedEvent.eventId,
    routingBasis: 'STATIC_EVENT_TYPE_MAP',
    requests: departments.map(department => ({
      requestId: `department-review:${parsedEvent.eventId}:${department}`,
      department,
      eventId: parsedEvent.eventId,
      eventType: parsedEvent.eventType,
      subject: parsedEvent.subject,
      occurredAt: parsedEvent.occurredAt,
      recordedAt: parsedEvent.recordedAt,
      sourceProvenanceState: parsedEvent.provenance.state,
      requiresHumanReview: true,
      executionAuthorized: false,
    })),
    requiresHumanReview: true,
    executionAuthorized: false,
  });
}
