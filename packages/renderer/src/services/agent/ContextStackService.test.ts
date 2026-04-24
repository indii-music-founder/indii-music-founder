/**
 * ContextStackService.test.ts
 * Unit tests for multi-turn context management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextStackService } from './ContextStackService';

describe('ContextStackService', () => {
  let service: ContextStackService;

  beforeEach(() => {
    service = new ContextStackService();
  });

  describe('Stack Operations', () => {
    it('should push and pop frames', () => {
      const frame = service.push('test-topic', { data: 'test' });
      expect(frame.frameId).toBeDefined();
      expect(frame.topic).toBe('test-topic');

      const popped = service.pop();
      expect(popped).not.toBeNull();
      expect(popped?.frameId).toBe(frame.frameId);
    });

    it('should peek without removing', () => {
      service.push('topic-1', { data: 'test1' });
      service.push('topic-2', { data: 'test2' });

      const peeked = service.peek();
      expect(peeked?.topic).toBe('topic-2');

      const state = service.getState();
      expect(state.currentDepth).toBe(2);
    });

    it('should return null on pop from empty stack', () => {
      const popped = service.pop();
      expect(popped).toBeNull();
    });
  });

  describe('Depth Management', () => {
    it('should track current depth', () => {
      service.push('topic-1', {});
      service.push('topic-2', {});
      service.push('topic-3', {});

      const state = service.getState();
      expect(state.currentDepth).toBe(3);
    });

    it('should enforce max depth', () => {
      for (let i = 0; i < 10; i++) {
        service.push(`topic-${i}`, { index: i });
      }

      const state = service.getState();
      expect(state.currentDepth).toBeLessThanOrEqual(state.maxDepth);
    });
  });

  describe('Token Budget', () => {
    it('should track token usage', () => {
      service.push('topic-1', {}, { tokenCount: 100 });
      service.push('topic-2', {}, { tokenCount: 150 });

      const status = service.getTokenBudgetStatus();
      expect(status.used).toBe(250);
      expect(status.available).toBeGreaterThan(0);
    });

    it('should report budget status', () => {
      service.push('topic', {}, { tokenCount: 5000 });

      const status = service.getTokenBudgetStatus();
      expect(status.isWarning || status.isExceeded).toBeDefined();
      expect(status.percentageUsed).toBeGreaterThan(0);
    });
  });

  describe('Frame Management', () => {
    it('should check if frame exists', () => {
      const frame = service.push('test', {});
      expect(service.frameExists(frame.frameId)).toBe(true);
      expect(service.frameExists('nonexistent')).toBe(false);
    });

    it('should retrieve frame by ID', () => {
      const frame = service.push('test', { data: 'value' });
      const retrieved = service.getFrame(frame.frameId);
      expect(retrieved?.frameId).toBe(frame.frameId);
    });
  });

  describe('Clear', () => {
    it('should clear all frames', () => {
      service.push('topic-1', {});
      service.push('topic-2', {});
      service.clear();

      const state = service.getState();
      expect(state.currentDepth).toBe(0);
      expect(state.frames.length).toBe(0);
    });
  });

  describe('Context Window', () => {
    it('should build context window', () => {
      service.push('topic-1', { data: 'test' });
      const window = service.buildContextWindow();

      expect(window.currentFrame).not.toBeNull();
      expect(window.contextDepth).toBe(1);
      expect(window.tokenUsage).toBeDefined();
    });
  });
});
