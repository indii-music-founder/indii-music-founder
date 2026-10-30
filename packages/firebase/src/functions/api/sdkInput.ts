import { z } from 'zod';
import { CreateTrackSchema, CreateDistributionSchema } from '@indii/shared';
import { HttpsError } from 'firebase-functions/v2/https';

// Request contracts contain client-editable fields only. Ownership/status/time
// are established by the authenticated operation, never copied from raw input.
export const SdkCreateTrack = CreateTrackSchema.extend({
  duration: z.number().finite().nonnegative(),
  bpm: z.number().finite().positive().optional(),
}).strict();
export const SdkUpdateTrack = SdkCreateTrack.partial().refine(value => Object.keys(value).length > 0, 'Provide at least one editable field.');
export const SdkCreateDistribution = CreateDistributionSchema.strict();
export const SdkUpdateProfile = z.object({ name: z.string().trim().min(1).max(255) }).strict();

export function sdkPagination(query: Record<string, unknown>): { limit: number; offset: number } {
  const integer = (value: unknown, fallback: number, max: number) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new HttpsError('invalid-argument', 'Pagination must use nonnegative integers.');
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed > max) throw new HttpsError('invalid-argument', 'Pagination is out of range.');
    return parsed;
  };
  const limit = integer(query.limit, 20, 100);
  if (limit < 1) throw new HttpsError('invalid-argument', 'Page limit must be positive.');
  return { limit, offset: integer(query.offset, 0, 10000) };
}
