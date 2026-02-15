import { describe, it, expect, vi, beforeEach } from 'vitest';
import { events, EventType, AgentActionEvent, DepartmentRequestEvent, SystemAlertEvent } from './events';

describe('EventBus', () => {
    beforeEach(() => {
        // Clear all listeners before each test
        (events as any).listeners = {};
    });

    describe('on() method', () => {
        it('should register an event listener', () => {
            const callback = vi.fn();
            events.on('AGENT_ACTION', callback);

            expect((events as any).listeners['AGENT_ACTION']).toBeDefined();
            expect((events as any).listeners['AGENT_ACTION']).toContain(callback);
        });

        it('should register multiple listeners for same event', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            events.on('AGENT_ACTION', callback1);
            events.on('AGENT_ACTION', callback2);

            expect((events as any).listeners['AGENT_ACTION']).toHaveLength(2);
        });

        it('should register listeners for different events', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            events.on('AGENT_ACTION', callback1);
            events.on('SYSTEM_ALERT', callback2);

            expect((events as any).listeners['AGENT_ACTION']).toBeDefined();
            expect((events as any).listeners['SYSTEM_ALERT']).toBeDefined();
        });
    });

    describe('emit() method', () => {
        it('should call registered listeners when event is emitted', () => {
            const callback = vi.fn();
            events.on('AGENT_ACTION', callback);

            const data: AgentActionEvent = {
                agentId: 'test-agent',
                action: 'generate',
                details: 'Test action'
            };

            events.emit('AGENT_ACTION', data);

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(data);
        });

        it('should call all registered listeners for an event', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();
            const callback3 = vi.fn();

            events.on('AGENT_ACTION', callback1);
            events.on('AGENT_ACTION', callback2);
            events.on('AGENT_ACTION', callback3);

            const data: AgentActionEvent = {
                agentId: 'test-agent',
                action: 'generate',
                details: 'Test action'
            };

            events.emit('AGENT_ACTION', data);

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledTimes(1);
            expect(callback3).toHaveBeenCalledTimes(1);
        });

        it('should not call listeners for different events', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            events.on('AGENT_ACTION', callback1);
            events.on('SYSTEM_ALERT', callback2);

            events.emit('AGENT_ACTION', { agentId: 'test', action: 'test', details: 'test' });

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback2).not.toHaveBeenCalled();
        });

        it('should do nothing if no listeners are registered', () => {
            expect(() => {
                events.emit('AGENT_ACTION', { agentId: 'test', action: 'test', details: 'test' });
            }).not.toThrow();
        });

        it('should handle complex event data', () => {
            const callback = vi.fn();
            events.on('DEPARTMENT_REQUEST', callback);

            const data: DepartmentRequestEvent = {
                fromDept: 'creative',
                toDept: 'marketing',
                request: 'Generate social media content'
            };

            events.emit('DEPARTMENT_REQUEST', data);

            expect(callback).toHaveBeenCalledWith(data);
        });
    });

    describe('off() method', () => {
        it('should remove a specific listener', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            events.on('AGENT_ACTION', callback1);
            events.on('AGENT_ACTION', callback2);

            events.off('AGENT_ACTION', callback1);

            expect((events as any).listeners['AGENT_ACTION']).toHaveLength(1);
            expect((events as any).listeners['AGENT_ACTION']).toContain(callback2);
            expect((events as any).listeners['AGENT_ACTION']).not.toContain(callback1);
        });

        it('should not remove other listeners', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            events.on('AGENT_ACTION', callback1);
            events.on('AGENT_ACTION', callback2);

            events.off('AGENT_ACTION', callback1);

            events.emit('AGENT_ACTION', { agentId: 'test', action: 'test', details: 'test' });

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledTimes(1);
        });

        it('should handle removing non-existent listener', () => {
            const callback = vi.fn();

            expect(() => {
                events.off('AGENT_ACTION', callback);
            }).not.toThrow();
        });

        it('should handle removing from non-existent event', () => {
            const callback = vi.fn();

            expect(() => {
                events.off('TASK_COMPLETED' as EventType, callback);
            }).not.toThrow();
        });
    });

    describe('Event Types', () => {
        it('should handle TASK_COMPLETED event', () => {
            const callback = vi.fn();
            events.on('TASK_COMPLETED', callback);

            events.emit('TASK_COMPLETED', { taskId: '123', result: 'success' });

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should handle TASK_FAILED event', () => {
            const callback = vi.fn();
            events.on('TASK_FAILED', callback);

            events.emit('TASK_FAILED', { taskId: '123', error: 'Test error' });

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should handle SYSTEM_ALERT event', () => {
            const callback = vi.fn();
            events.on('SYSTEM_ALERT', callback);

            const data: SystemAlertEvent = {
                level: 'error',
                message: 'System error occurred'
            };

            events.emit('SYSTEM_ALERT', data);

            expect(callback).toHaveBeenCalledWith(data);
        });

        it('should handle IMAGE_GENERATED event', () => {
            const callback = vi.fn();
            events.on('IMAGE_GENERATED', callback);

            events.emit('IMAGE_GENERATED', { imageId: '123', url: 'test.png' });

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should handle VIDEO_RENDER_COMPLETE event', () => {
            const callback = vi.fn();
            events.on('VIDEO_RENDER_COMPLETE', callback);

            events.emit('VIDEO_RENDER_COMPLETE', { videoId: '123', url: 'test.mp4' });

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should handle SESSION_STARTED event', () => {
            const callback = vi.fn();
            events.on('SESSION_STARTED', callback);

            events.emit('SESSION_STARTED', { sessionId: '123', userId: 'user-1' });

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should handle PROJECT_SWITCHED event', () => {
            const callback = vi.fn();
            events.on('PROJECT_SWITCHED', callback);

            events.emit('PROJECT_SWITCHED', { oldProjectId: '1', newProjectId: '2' });

            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe('Edge Cases', () => {
        it('should handle listener that throws an error', () => {
            const errorCallback = vi.fn(() => {
                throw new Error('Listener error');
            });
            const normalCallback = vi.fn();

            events.on('AGENT_ACTION', errorCallback);
            events.on('AGENT_ACTION', normalCallback);

            expect(() => {
                events.emit('AGENT_ACTION', { agentId: 'test', action: 'test', details: 'test' });
            }).toThrow();

            // First callback threw, but we can still call emit again
            expect(errorCallback).toHaveBeenCalledTimes(1);
            // normalCallback was NOT called because the error propagated (no isolation)
            expect(normalCallback).not.toHaveBeenCalled();
        });

        it('should handle multiple on/off operations', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            events.on('AGENT_ACTION', callback1);
            events.on('AGENT_ACTION', callback2);
            events.off('AGENT_ACTION', callback1);
            events.on('AGENT_ACTION', callback1);

            events.emit('AGENT_ACTION', { agentId: 'test', action: 'test', details: 'test' });

            expect(callback1).toHaveBeenCalledTimes(1);
            expect(callback2).toHaveBeenCalledTimes(1);
        });

        it('should maintain separate listener arrays for different events', () => {
            const callback1 = vi.fn();
            const callback2 = vi.fn();

            events.on('AGENT_ACTION', callback1);
            events.on('SYSTEM_ALERT', callback2);

            events.off('AGENT_ACTION', callback1);

            expect((events as any).listeners['SYSTEM_ALERT']).toContain(callback2);
        });
    });
});