import type { z } from 'zod';
import type { GenerateOmniRemixSchema } from '../../shared/creative';

type OmniRequest = z.infer<typeof GenerateOmniRemixSchema>;

/** Vertex edit requests preserve source framing and length instead of requesting new ones. */
export function buildOmniResponseFormat(
  task: NonNullable<OmniRequest['task']>,
  aspectRatio: OmniRequest['aspectRatio'],
  resolution: OmniRequest['resolution'],
  durationSeconds: number,
) {
  return {
    type: 'video' as const,
    ...(task === 'edit' ? {} : {
      aspect_ratio: aspectRatio,
      duration: `${durationSeconds}s`,
    }),
    resolution,
    // Receive bytes in the authenticated backend and persist them in owner storage.
    delivery: 'inline' as const,
  };
}
