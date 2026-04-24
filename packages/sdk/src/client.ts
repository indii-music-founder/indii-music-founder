/**
 * IndiiOS SDK Client — Official TypeScript SDK for indiiOS REST API
 *
 * Provides type-safe access to:
 * - Track management
 * - Analytics and events
 * - Distributions
 * - Webhooks
 * - User account operations
 */

import type { Track, CreateTrack, UpdateTrack, Distribution, CreateDistribution, AnalyticsEvent } from '@indiios/shared';
import { TrackSchema, CreateTrackSchema, UpdateTrackSchema, DistributionSchema, CreateDistributionSchema } from '@indiios/shared';

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

export class IndiiOSClient {
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
      'User-Agent': `indiiOS-sdk/0.1.0`,
    };
  }

  private async request<T>(method: string, endpoint: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    const url = `${this.apiUrl}/api${endpoint}`;
    const timeout = opts?.timeout ?? this.timeout;
    const retries = opts?.retries ?? 3;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method,
          headers: this.baseHeaders,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: response.statusText }));
          throw new IndiiOSError(`API error: ${response.status}`, response.status, error);
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
      }
    }

    throw lastError ?? new Error('Request failed');
  }

  // Track Management
  async getTrack(trackId: string): Promise<Track> {
    return this.request<Track>('GET', `/tracks/${trackId}`);
  }

  async listTracks(params?: PaginationParams): Promise<Track[]> {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const endpoint = `/tracks${query.toString() ? `?${query.toString()}` : ''}`;
    return this.request<Track[]>('GET', endpoint);
  }

  async createTrack(data: CreateTrack): Promise<Track> {
    const validated = CreateTrackSchema.parse(data);
    return this.request<Track>('POST', '/tracks', validated);
  }

  async updateTrack(trackId: string, data: Partial<UpdateTrack>): Promise<Track> {
    const validated = UpdateTrackSchema.partial().parse(data);
    return this.request<Track>('PATCH', `/tracks/${trackId}`, validated);
  }

  async deleteTrack(trackId: string): Promise<void> {
    await this.request<void>('DELETE', `/tracks/${trackId}`);
  }

  // Distribution Management
  async getDistribution(distributionId: string): Promise<Distribution> {
    return this.request<Distribution>('GET', `/distributions/${distributionId}`);
  }

  async listDistributions(params?: PaginationParams): Promise<Distribution[]> {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const endpoint = `/distributions${query.toString() ? `?${query.toString()}` : ''}`;
    return this.request<Distribution[]>('GET', endpoint);
  }

  async createDistribution(data: CreateDistribution): Promise<Distribution> {
    const validated = CreateDistributionSchema.parse(data);
    return this.request<Distribution>('POST', '/distributions', validated);
  }

  async submitDistribution(distributionId: string): Promise<Distribution> {
    return this.request<Distribution>('POST', `/distributions/${distributionId}/submit`);
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

  async updateProfile(data: { name?: string }): Promise<{ id: string; email: string; name: string }> {
    return this.request('PATCH', '/account/profile', data);
  }
}

// Error class
export class IndiiOSError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'IndiiOSError';
  }
}

// Retry logic
function isRetryableError(error: Error): boolean {
  if (error instanceof IndiiOSError) {
    // Retry on 5xx and specific 4xx errors
    return (error.statusCode ?? 0) >= 500 || [408, 429].includes(error.statusCode ?? 0);
  }
  // Retry on network errors
  const msg = error.message.toLowerCase();
  return msg.includes('network') || msg.includes('timeout') || msg.includes('abort');
}

// Export singleton factory
export function createClient(config: ClientConfig): IndiiOSClient {
  return new IndiiOSClient(config);
}

export default IndiiOSClient;
