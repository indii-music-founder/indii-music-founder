/**
 * client.test.ts
 * Unit tests for indii SDK client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { indiiClient, createClient, indiiError } from './client';

describe('indiiClient', () => {
  let client: indiiClient;

  beforeEach(() => {
    client = createClient({
      apiUrl: 'https://api.example.com',
      apiKey: 'test-api-key',
      timeout: 5000,
    });
  });

  describe('Initialization', () => {
    it('should create client with config', () => {
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(indiiClient);
    });

    it('should handle trailing slash in API URL', () => {
      const client1 = createClient({
        apiUrl: 'https://api.example.com/',
        apiKey: 'test-key',
      });
      expect(client1).toBeDefined();
    });
  });

  describe('Track Methods', () => {
    it('should have getTrack method', () => {
      expect(typeof client.getTrack).toBe('function');
    });

    it('should have listTracks method', () => {
      expect(typeof client.listTracks).toBe('function');
    });

    it('should have createTrack method', () => {
      expect(typeof client.createTrack).toBe('function');
    });

    it('should have updateTrack method', () => {
      expect(typeof client.updateTrack).toBe('function');
    });

    it('should have deleteTrack method', () => {
      expect(typeof client.deleteTrack).toBe('function');
    });
  });

  describe('Distribution Methods', () => {
    it('should have getDistribution method', () => {
      expect(typeof client.getDistribution).toBe('function');
    });

    it('should have listDistributions method', () => {
      expect(typeof client.listDistributions).toBe('function');
    });

    it('should have createDistribution method', () => {
      expect(typeof client.createDistribution).toBe('function');
    });

    it('should have submitDistribution method', () => {
      expect(typeof client.submitDistribution).toBe('function');
    });
  });

  describe('Analytics Methods', () => {
    it('should have getEvents method', () => {
      expect(typeof client.getEvents).toBe('function');
    });

    it('should have getEventsByType method', () => {
      expect(typeof client.getEventsByType).toBe('function');
    });
  });

  describe('Account Methods', () => {
    it('should have getProfile method', () => {
      expect(typeof client.getProfile).toBe('function');
    });

    it('should have updateProfile method', () => {
      expect(typeof client.updateProfile).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should throw indiiError with status code', () => {
      const error = new indiiError('Test error', 400, { field: 'value' });
      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'value' });
    });

    it('should have correct error name', () => {
      const error = new indiiError('Test');
      expect(error.name).toBe('indiiError');
    });
  });

  describe('Configuration', () => {
    it('should accept custom timeout', () => {
      const clientWithTimeout = createClient({
        apiUrl: 'https://api.example.com',
        apiKey: 'key',
        timeout: 10000,
      });
      expect(clientWithTimeout).toBeDefined();
    });

    it('should have default timeout', () => {
      const clientDefault = createClient({
        apiUrl: 'https://api.example.com',
        apiKey: 'key',
      });
      expect(clientDefault).toBeDefined();
    });
  });

  describe('Retry policy', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('does NOT retry POST/PATCH mutations on retryable failures (no duplicate side effects)', async () => {
      vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'));

      await expect(client.createTrack({ title: 't', duration: 180 } as never)).rejects.toThrow();

      // Exactly one attempt for a POST — auto-retry is idempotent-only.
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('retries GET requests on network failures', async () => {
      vi.mocked(fetch)
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: { id: '1', title: 't', artist: 'a' } }),
        } as Response);

      const track = await client.getTrack('1');
      expect(track.id).toBe('1');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('honors an explicit retries option on non-idempotent methods', async () => {
      vi.mocked(fetch)
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: { id: '1' } }),
        } as Response);

      const track = await client.createTrack({ title: 't', duration: 180 } as never, { retries: 1 } as never);
      expect(track).toEqual({ id: '1' });
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Response handling', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('accepts an empty 204 response for DELETE instead of failing to parse JSON', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: async () => { throw new SyntaxError('Unexpected end of JSON input'); },
      } as unknown as Response));

      await expect(client.deleteTrack('track-1')).resolves.toBeUndefined();
    });

    it('URL-encodes path parameters so ids cannot inject path segments', async () => {
      let calledUrl = '';
      vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        calledUrl = String(url);
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { id: 'x' } }),
        } as unknown as Response;
      }));

      await client.getTrack('a/b?c=d');

      expect(calledUrl).toContain('/tracks/a%2Fb%3Fc%3Dd');
      expect(calledUrl).not.toContain('/tracks/a/b');
    });
  });
});
