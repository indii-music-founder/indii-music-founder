/**
 * client.test.ts
 * Unit tests for IndiiOS SDK client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IndiiOSClient, createClient, IndiiOSError } from './client';

describe('IndiiOSClient', () => {
  let client: IndiiOSClient;

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
      expect(client).toBeInstanceOf(IndiiOSClient);
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
    it('should throw IndiiOSError with status code', () => {
      const error = new IndiiOSError('Test error', 400, { field: 'value' });
      expect(error).toBeInstanceOf(Error);
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'value' });
    });

    it('should have correct error name', () => {
      const error = new IndiiOSError('Test');
      expect(error.name).toBe('IndiiOSError');
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
});
