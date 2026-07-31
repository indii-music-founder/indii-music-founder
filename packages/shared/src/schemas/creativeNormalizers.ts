import { z } from 'zod';
import { GenerateVideoSchema } from './creative.js';

export function normalizeVideoResolution(
  resolution: z.infer<typeof GenerateVideoSchema>['resolution'] | undefined,
  model: string | undefined,
): '720p' | '1080p' | '4k' {
  const normalizedInput = resolution ?? '720p';
  const normalizedModel = model && model.includes('lite') ? 'lite' : 'fast';
  const normalized = normalizedInput === '1280x720'
    ? '720p'
    : normalizedInput === '1920x1080'
      ? '1080p'
      : normalizedInput === '3840x2160'
        ? '4k'
        : normalizedInput;

  if (normalizedModel === 'lite' && normalized === '4k') return '1080p';
  return normalized;
}

export function normalizeVideoDuration(
  durationSeconds: number | undefined, 
  resolution: string, 
  hasFrameInput: boolean
): 4 | 6 | 8 {
  const safeDurationSeconds = durationSeconds ?? 8;
  if (resolution !== '720p' || hasFrameInput) return 8;
  if (safeDurationSeconds <= 4) return 4;
  if (safeDurationSeconds <= 6) return 6;
  return 8;
}

export function normalizeVideoAspectRatio(
  aspectRatio: z.infer<typeof GenerateVideoSchema>['aspectRatio'] | undefined
): '16:9' | '9:16' {
  // Veo only honors 9:16 specially, coercing everything else to 16:9.
  return aspectRatio === '9:16' ? '9:16' : '16:9';
}

export type VeoPersonGeneration = 'dont_allow' | 'allow_adult';

export function normalizePersonGeneration(
  personGeneration: z.infer<typeof GenerateVideoSchema>['personGeneration'],
): VeoPersonGeneration | undefined {
  if (personGeneration === 'dont_allow') return 'dont_allow';
  if (personGeneration === 'allow_adult' || personGeneration === 'allow_all') return 'allow_adult';
  return undefined;
}

export function normalizeVideoSeed(seed?: number | string): number | undefined {
  if (seed === undefined || seed === '') return undefined;
  const parsed = typeof seed === 'string' ? Number(seed) : seed;
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}
