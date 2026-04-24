/**
 * @indiios/sdk — Official TypeScript SDK for indiiOS
 *
 * Usage:
 * ```
 * import { createClient } from '@indiios/sdk';
 *
 * const client = createClient({
 *   apiUrl: 'https://api.indiios.com',
 *   apiKey: 'your-api-key'
 * });
 *
 * const track = await client.getTrack('track-id');
 * ```
 */

export { IndiiOSClient, createClient, IndiiOSError } from './client';
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
} from '@indiios/shared';
