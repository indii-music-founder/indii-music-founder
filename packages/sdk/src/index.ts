/**
 * @indii/sdk — Official TypeScript SDK for indii
 *
 * Usage:
 * ```
 * import { createClient } from '@indii/sdk';
 *
 * const client = createClient({
 *   apiUrl: 'https://app.indii.music',
 *   idToken: await signedInFirebaseUser.getIdToken()
 * });
 *
 * const track = await client.getTrack('track-id');
 * ```
 */

export { indiiClient, createClient, indiiError } from './client';
export type { ClientConfig, RequestOptions, PaginationParams } from './client';

// Re-export shared types for convenience
export type {
  Track,
  CreateTrack,
  UpdateTrack,
  Distribution,
  CreateDistribution,
  Webhook,
  CreateWebhook,
  AnalyticsEvent,
  CatalogJsonLd,
} from '@indii/shared';
