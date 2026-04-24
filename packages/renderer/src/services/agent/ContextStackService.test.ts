/**
 * ContextStackService Unit Tests
 *
 * Tests the multi-turn context stack: push/pop/peek, rolling window,
 * summarization, and serialization/restore.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextStackServiceImpl } from '@/services/agent/ContextStackService';
import type { ContextFrame } from '@/services/agent/types';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestFrame(overrides: Partial<ContextFrame> = {}): ContextFrame {
    return {
        turnId: `turn_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        timestamp: Date.now(),
        userMessage: 'Test user message',
        agentResponse: 'Test agent response',
        toolCalls: [],
        decisions: [],
        memoryWrites: [],
        ...overrides,
    };
}

// ============================================================================
// Tests
// ============================================================================

describe('📚 ContextStackService', () => {
    let service: ContextStackServiceImpl;

    beforeEach(() => {
        service = new ContextStackServiceImpl({ maxFrames: 5, maxSummaryChars: 500 });
    });

    // ====================================================================
    // Stack Operations
    // ====================================================================

    describe('Stack Operations', () => {
        it('should start empty', () => {
            expect(service.size).toBe(0);
            expect(service.isEmpty).toBe(true);
            expect(service.peek()).toBeUndefined();
        });

        it('should push and peek a frame', () => {
            const frame = createTestFrame({ userMessage: 'Hello' });
            service.push(frame);

            expect(service.size).toBe(1);
            expect(service.isEmpty).toBe(false);
            expect(service.peek()).toEqual(frame);
        });

        it('should pop the most recent frame', () => {
            const frame1 = createTestFrame({ userMessage: 'First' });
            const frame2 = createTestFrame({ userMessage: 'Second' });
            service.push(frame1);
            service.push(frame2);

            const popped = service.pop();
            expect(popped).toEqual(frame2);
            expect(service.size).toBe(1);
            expect(service.peek()).toEqual(frame1);
        });

        it('should return undefined when popping an empty stack', () => {
            expect(service.pop()).toBeUndefined();
        });

        it('should return recent frames in reverse chronological order', () => {
            const frame1 = createTestFrame({ userMessage: 'First' });
            const frame2 = createTestFrame({ userMessage: 'Second' });
            const frame3 = createTestFrame({ userMessage: 'Third' });
            service.push(frame1);
            service.push(frame2);
            service.push(frame3);

            const recent = service.getRecentFrames(2);
            expect(recent).toHaveLength(2);
            expect(recent[0]!.userMessage).toBe('Third');
            expect(recent[1]!.userMessage).toBe('Second');
        });

        it('should handle getRecentFrames(n) where n exceeds stack size', () => {
            const frame = createTestFrame();
            service.push(frame);

            const recent = service.getRecentFrames(10);
            expect(recent).toHaveLength(1);
            expect(recent[0]).toEqual(frame);
        });

        it('should clear all frames', () => {
            service.push(createTestFrame());
            service.push(createTestFrame());
            service.clear();

            expect(service.size).toBe(0);
            expect(service.isEmpty).toBe(true);
        });
    });

    // ====================================================================
    // Rolling Window
    // ====================================================================

    describe('Rolling Window', () => {
        it('should evict the oldest frame when exceeding maxFrames', () => {
            const frames: ContextFrame[] = [];
            for (let i = 0; i < 7; i++) {
                const f = createTestFrame({ userMessage: `Message ${i}` });
                frames.push(f);
                service.push(f);
            }

            // maxFrames = 5, so the two oldest should be evicted
            expect(service.size).toBe(5);

            const recent = service.getRecentFrames(5);
            expect(recent[0]!.userMessage).toBe('Message 6');
            expect(recent[4]!.userMessage).toBe('Message 2');
        });
    });

    // ====================================================================
    // Summarization
    // ====================================================================

    describe('Summarization', () => {
        it('should return empty string for empty stack', () => {
            expect(service.summarize()).toBe('');
        });

        it('should produce a structured summary with turn numbers', () => {
            service.push(createTestFrame({
                userMessage: 'What genres work best?',
                agentResponse: 'Based on your profile, hip-hop and R&B.',
            }));
            service.push(createTestFrame({
                userMessage: 'Set up my distribution',
                agentResponse: 'I\'ll configure DistroKid for your next release.',
                toolCalls: [{ name: 'setupDistribution', args: {}, result: {} }],
                decisions: ['Chose DistroKid over TuneCore'],
            }));

            const summary = service.summarize();

            expect(summary).toContain('CONVERSATION HISTORY (2 turns)');
            expect(summary).toContain('Turn 1:');
            expect(summary).toContain('Turn 2:');
            expect(summary).toContain('genres');
            expect(summary).toContain('setupDistribution');
            expect(summary).toContain('Chose DistroKid');
        });

        it('should respect maxSummaryChars budget', () => {
            // Use a very tight budget to guarantee eviction triggers
            const tightService = new ContextStackServiceImpl({
                maxFrames: 10,
                maxSummaryChars: 200,
            });

            // Fill with messages that will exceed the tight budget
            for (let i = 0; i < 5; i++) {
                tightService.push(createTestFrame({
                    userMessage: 'A'.repeat(200),
                    agentResponse: 'B'.repeat(200),
                }));
            }

            const summary = tightService.summarize();
            expect(summary.length).toBeLessThanOrEqual(400); // budget + some header overhead
            expect(summary).toContain('older turns omitted');
        });
    });

    // ====================================================================
    // Persistence
    // ====================================================================

    describe('Persistence', () => {
        it('should serialize and restore the stack losslessly', () => {
            const frame1 = createTestFrame({
                turnId: 'turn_1',
                userMessage: 'Hello',
                agentResponse: 'Hi there',
                toolCalls: [{ name: 'greet', args: {}, result: 'ok' }],
                decisions: ['Used friendly tone'],
                memoryWrites: ['greeting_style'],
            });
            const frame2 = createTestFrame({
                turnId: 'turn_2',
                userMessage: 'Set up release',
                agentResponse: 'Done!',
            });

            service.push(frame1);
            service.push(frame2);

            const serialized = service.serialize();

            // Create a new service and restore
            const newService = new ContextStackServiceImpl({ maxFrames: 5, maxSummaryChars: 500 });
            newService.restore(serialized);

            expect(newService.size).toBe(2);
            expect(newService.peek()!.turnId).toBe('turn_2');

            const recent = newService.getRecentFrames(2);
            expect(recent[0]!.turnId).toBe('turn_2');
            expect(recent[1]!.turnId).toBe('turn_1');
            expect(recent[1]!.toolCalls).toHaveLength(1);
            expect(recent[1]!.decisions).toEqual(['Used friendly tone']);
        });

        it('should silently handle invalid serialized data', () => {
            service.restore('not-valid-json');
            expect(service.size).toBe(0);
        });

        it('should filter out frames with invalid structure during restore', () => {
            const validFrame = {
                turnId: 'valid',
                timestamp: Date.now(),
                userMessage: 'hello',
                agentResponse: 'hi',
                toolCalls: [],
                decisions: [],
                memoryWrites: [],
            };

            const invalidFrame = {
                turnId: 'invalid',
                // missing required fields
            };

            service.restore(JSON.stringify([validFrame, invalidFrame]));
            expect(service.size).toBe(1);
            expect(service.peek()!.turnId).toBe('valid');
        });

        it('should enforce maxFrames during restore', () => {
            const frames = Array.from({ length: 10 }, (_, i) =>
                createTestFrame({ turnId: `turn_${i}` })
            );

            service.restore(JSON.stringify(frames));
            expect(service.size).toBe(5); // maxFrames = 5
        });
    });

    // ====================================================================
    // Static Frame Builder
    // ====================================================================

    describe('createFrame', () => {
        it('should create a valid frame with auto-generated turnId', () => {
            const frame = ContextStackServiceImpl.createFrame(
                'User question',
                'Agent answer',
                {
                    toolCalls: [{ name: 'search', args: { q: 'test' }, result: ['a'] }],
                    decisions: ['Used RAG'],
                    memoryWrites: ['search_query'],
                }
            );

            expect(frame.turnId).toMatch(/^turn_\d+_[a-z0-9]+$/);
            expect(frame.timestamp).toBeGreaterThan(0);
            expect(frame.userMessage).toBe('User question');
            expect(frame.agentResponse).toBe('Agent answer');
            expect(frame.toolCalls).toHaveLength(1);
            expect(frame.decisions).toEqual(['Used RAG']);
            expect(frame.memoryWrites).toEqual(['search_query']);
        });

        it('should default optional arrays to empty', () => {
            const frame = ContextStackServiceImpl.createFrame('Q', 'A');
            expect(frame.toolCalls).toEqual([]);
            expect(frame.decisions).toEqual([]);
            expect(frame.memoryWrites).toEqual([]);
        });
    });
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
