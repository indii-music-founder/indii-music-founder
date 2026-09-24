import { z } from 'zod';

const CanonicalEntityIdSchema = z.string().trim().min(1).max(160).refine(
  value => !/^(?:isrc|iswc|upc|ean|isni|ipi|dpid|spotify|apple(?:_music)?|youtube|tiktok|instagram):/i.test(value)
    && !/^(?:[A-Z]{2}[A-Z0-9]{3}\d{7}|T-\d{3}\.\d{3}\.\d{3}-\d|\d{8,14})$/i.test(value),
  'External identifier values must be stored as identifiers, not canonical entity IDs.',
);

/**
 * Provider-neutral execution planning for canonical music actions.
 *
 * This is a deterministic plan contract only: it does not dispatch work,
 * grant permissions, or mark a business action complete. The caller supplies
 * capabilities that have already been verified for the current user/session.
 */
export const MusicActionCheckpointSchema = z.enum([
  'MFA',
  'LEGAL_ATTESTATION',
  'SIGNATURE',
  'PAYMENT',
  'BINDING_CHOICE',
  'OWNERSHIP_CONFIRMATION',
  'TERMS_ACCEPTANCE',
]);
export type MusicActionCheckpoint = z.infer<typeof MusicActionCheckpointSchema>;

export const MusicActionExecutionRouteSchema = z.enum([
  'OFFICIAL_API',
  'OAUTH_API',
  'BROWSER_AUTOMATION',
  'DESKTOP_CONTROL',
  'GUIDED_MANUAL',
]);
export type MusicActionExecutionRoute = z.infer<typeof MusicActionExecutionRouteSchema>;

export const MusicActionExecutionCapabilitiesSchema = z.object({
  officialApiAvailable: z.boolean().default(false),
  oauthApiAvailable: z.boolean().default(false),
  browserAutomationAvailable: z.boolean().default(false),
  desktopControlAvailable: z.boolean().default(false),
  /** Must reflect explicit, current AOP authorization; absence is false. */
  autonomousComputerControlAuthorized: z.boolean().default(false),
}).strict();
export type MusicActionExecutionCapabilities = z.infer<typeof MusicActionExecutionCapabilitiesSchema>;

export const MusicActionExecutionRequestSchema = z.object({
  actionId: z.string().trim().min(1).max(160),
  subjectEntityId: CanonicalEntityIdSchema,
  checkpoints: z.array(MusicActionCheckpointSchema).max(20).default([]),
  capabilities: MusicActionExecutionCapabilitiesSchema.default({}),
}).strict();
export type MusicActionExecutionRequest = z.input<typeof MusicActionExecutionRequestSchema>;

export const MusicActionExecutionPlanSchema = z.object({
  schemaVersion: z.literal('music-action-execution-plan.v1'),
  actionId: z.string().trim().min(1).max(160),
  subjectEntityId: z.string().trim().min(1).max(160),
  route: MusicActionExecutionRouteSchema,
  status: z.enum(['READY', 'AWAITING_HUMAN']),
  checkpoints: z.array(MusicActionCheckpointSchema).max(20),
  reason: z.string().trim().min(1).max(500),
}).strict();
export type MusicActionExecutionPlan = z.infer<typeof MusicActionExecutionPlanSchema>;

/**
 * Selects the highest-priority verified route. Browser/desktop routes are
 * skipped whenever a human checkpoint is required; those actions stop for a
 * guided human workflow. Desktop additionally requires explicit AOP consent.
 */
export function planMusicActionExecution(input: MusicActionExecutionRequest): MusicActionExecutionPlan {
  const request = MusicActionExecutionRequestSchema.parse(input);
  const checkpoints = [...new Set(request.checkpoints)];
  const capabilities = request.capabilities;

  let route: MusicActionExecutionRoute;
  let reason: string;
  if (capabilities.officialApiAvailable) {
    route = 'OFFICIAL_API';
    reason = 'Use the verified official API route.';
  } else if (capabilities.oauthApiAvailable) {
    route = 'OAUTH_API';
    reason = 'Use the verified OAuth/API workflow.';
  } else if (checkpoints.length > 0) {
    route = 'GUIDED_MANUAL';
    reason = 'A human checkpoint is required before any automated submission or binding action.';
  } else if (capabilities.browserAutomationAvailable) {
    route = 'BROWSER_AUTOMATION';
    reason = 'Use browser automation after higher-priority API routes were unavailable.';
  } else if (capabilities.desktopControlAvailable && capabilities.autonomousComputerControlAuthorized) {
    route = 'DESKTOP_CONTROL';
    reason = 'Use desktop control under explicit Artist Operating Profile authorization.';
  } else {
    route = 'GUIDED_MANUAL';
    reason = capabilities.desktopControlAvailable
      ? 'Desktop control is not authorized by the Artist Operating Profile.'
      : 'No verified automated route is available; continue with guided manual steps.';
  }

  return MusicActionExecutionPlanSchema.parse({
    schemaVersion: 'music-action-execution-plan.v1',
    actionId: request.actionId,
    subjectEntityId: request.subjectEntityId,
    route,
    status: checkpoints.length > 0 ? 'AWAITING_HUMAN' : 'READY',
    checkpoints,
    reason,
  });
}
