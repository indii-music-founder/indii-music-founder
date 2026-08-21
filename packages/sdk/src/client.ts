/**
 * indii SDK Client — Official TypeScript SDK for indii REST API
 *
 * Provides type-safe access to:
 * - Track management
 * - Analytics and events
 * - Distributions
 * - Webhooks
 * - User account operations
 */

import type { Track, CreateTrack, UpdateTrack, Distribution, CreateDistribution, AnalyticsEvent } from '@indii/shared';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { TrackSchema, CreateTrackSchema, UpdateTrackSchema, DistributionSchema, CreateDistributionSchema } from '@indii/shared';

export interface ClientConfig {
  apiUrl: string;
  apiKey: string;
  timeout?: number; // milliseconds
}

export interface RequestOptions {
  timeout?: number;
  retries?: number;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export class indiiClient {
  private apiUrl: string;
  private apiKey: string;
  private timeout: number;
  private baseHeaders: Record<string, string>;

  constructor(config: ClientConfig) {
    this.apiUrl = config.apiUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 30000;
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': `indii-sdk/0.1.0`,
    };
  }

  private async request<T>(method: string, endpoint: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    const url = `${this.apiUrl}/api${endpoint}`;
    const timeout = opts?.timeout ?? this.timeout;
    // Auto-retry only idempotent methods: a POST/PATCH that times out after
    // the server committed would otherwise be re-sent and duplicate the
    // mutation (duplicate track, duplicate distribution). Callers may opt in
    // explicitly with opts.retries for endpoints they know are safe.
    const retries = opts?.retries ?? (IDEMPOTENT_METHODS.has(method.toUpperCase()) ? 3 : 0);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      let controller: AbortController | undefined;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      try {
        controller = new AbortController();
        timeoutId = setTimeout(() => controller!.abort(), timeout);

        const response = await fetch(url, {
          method,
          headers: this.baseHeaders,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: response.statusText }));
          throw new indiiError(`API error: ${response.status}`, response.status, error);
        }

        // 204/205 (and other empty bodies) carry no JSON envelope.
        if (response.status === 204 || response.status === 205) {
          return undefined as T;
        }
        const data = await response.json();
        return data.data as T;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < retries && isRetryableError(lastError)) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw lastError;
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    throw lastError ?? new Error('Request failed');
  }

  // Track Management
  async getTrack(trackId: string): Promise<Track> {
    return this.request<Track>('GET', `/tracks/${encodeURIComponent(trackId)}`);
  }

  async listTracks(params?: PaginationParams): Promise<Track[]> {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const endpoint = `/tracks${query.toString() ? `?${query.toString()}` : ''}`;
    return this.request<Track[]>('GET', endpoint);
  }

  async createTrack(data: CreateTrack, opts?: RequestOptions): Promise<Track> {
    const validated = CreateTrackSchema.parse(data);
    return this.request<Track>('POST', '/tracks', validated, opts);
  }

  async updateTrack(trackId: string, data: Partial<UpdateTrack>, opts?: RequestOptions): Promise<Track> {
    const validated = UpdateTrackSchema.partial().parse(data);
    return this.request<Track>('PATCH', `/tracks/${encodeURIComponent(trackId)}`, validated, opts);
  }

  async deleteTrack(trackId: string): Promise<void> {
    await this.request<void>('DELETE', `/tracks/${encodeURIComponent(trackId)}`);
  }

  // Distribution Management
  async getDistribution(distributionId: string): Promise<Distribution> {
    return this.request<Distribution>('GET', `/distributions/${encodeURIComponent(distributionId)}`);
  }

  async listDistributions(params?: PaginationParams): Promise<Distribution[]> {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const endpoint = `/distributions${query.toString() ? `?${query.toString()}` : ''}`;
    return this.request<Distribution[]>('GET', endpoint);
  }

  async createDistribution(data: CreateDistribution, opts?: RequestOptions): Promise<Distribution> {
    const validated = CreateDistributionSchema.parse(data);
    return this.request<Distribution>('POST', '/distributions', validated, opts);
  }

  async submitDistribution(distributionId: string, opts?: RequestOptions): Promise<Distribution> {
    return this.request<Distribution>('POST', `/distributions/${encodeURIComponent(distributionId)}/submit`, undefined, opts);
  }

  // Analytics
  async getEvents(params?: PaginationParams): Promise<AnalyticsEvent[]> {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const endpoint = `/analytics/events${query.toString() ? `?${query.toString()}` : ''}`;
    return this.request<AnalyticsEvent[]>('GET', endpoint);
  }

  async getEventsByType(eventType: string, params?: PaginationParams): Promise<AnalyticsEvent[]> {
    const query = new URLSearchParams({ eventType });
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    return this.request<AnalyticsEvent[]>('GET', `/analytics/events?${query.toString()}`);
  }

  // Account & User
  async getProfile(): Promise<{ id: string; email: string; name: string }> {
    return this.request('GET', '/account/profile');
  }

  async updateProfile(data: { name?: string }, opts?: RequestOptions): Promise<{ id: string; email: string; name: string }> {
    return this.request('PATCH', '/account/profile', data, opts);
  }
}

// Error class
export class indiiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'indiiError';
  }
}

// Retry logic
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'PUT', 'DELETE']);

function isRetryableError(error: Error): boolean {
  if (error instanceof indiiError) {
    // Retry on 5xx and specific 4xx errors
    return (error.statusCode ?? 0) >= 500 || [408, 429].includes(error.statusCode ?? 0);
  }
  // Network/transport failures surface as TypeError from fetch; the
  // message-based fallback covers environments that throw other types.
  return error instanceof TypeError
    || ['network', 'timeout', 'abort'].some(keyword => error.message.toLowerCase().includes(keyword));
}

// Export singleton factory
export function createClient(config: ClientConfig): indiiClient {
  return new indiiClient(config);
}

export default indiiClient;
