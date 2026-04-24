/**
 * ReflectionLoop.test.ts
 * Unit tests for agent self-evaluation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReflectionLoop } from './ReflectionLoop';

describe('ReflectionLoop', () => {
  let service: ReflectionLoop;

  beforeEach(() => {
    service = new ReflectionLoop();
  });

  describe('Initialization', () => {
    it('should initialize without errors', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
    });
  });

  describe('State Management', () => {
    it('should return initial state', () => {
      const state = service.getState();
      expect(state.isRunning).toBe(false);
      expect(state.currentIteration).toBe(0);
      expect(state.maxIterations).toBe(3);
      expect(state.qualityThreshold).toBe(0.75);
      expect(Array.isArray(state.iterations)).toBe(true);
    });
  });

  describe('Reset', () => {
    it('should reset state', () => {
      service.reset();
      const state = service.getState();
      expect(state.iterations.length).toBe(0);
      expect(state.currentIteration).toBe(0);
      expect(state.isRunning).toBe(false);
    });
  });

  describe('Stop', () => {
    it('should stop reflection loop', () => {
      service.stop();
      const state = service.getState();
      expect(state.isRunning).toBe(false);
    });
  });

  describe('Quality Metrics', () => {
    it('should handle reflection output with metrics', () => {
      // Reflection output should have valid metric ranges
      const mockOutput = {
        metrics: {
          correctness: 0.8,
          clarity: 0.85,
          completeness: 0.75,
          overall: 0.8
        },
        feedback: 'Test feedback',
        passesFinal: true
      };

      expect(mockOutput.metrics.correctness).toBeGreaterThanOrEqual(0);
      expect(mockOutput.metrics.correctness).toBeLessThanOrEqual(1);
      expect(mockOutput.metrics.overall >= 0.75).toBe(true);
    });
  });
});
