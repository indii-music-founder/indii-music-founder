import { describe, expect, it, vi } from 'vitest';
import { events } from './events';
import { logger } from '@/utils/logger';

describe('EventBus', () => {
    it('continues delivering after a subscriber throws', () => {
        const warning = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const first = vi.fn(() => { throw new Error('private detail'); });
        const second = vi.fn();
        const offFirst = events.on('AGENT_ACTION', first);
        const offSecond = events.on('AGENT_ACTION', second);
        const payload = { agentId: 'agent', action: 'start', details: 'private detail' };
        try {
            expect(() => events.emit('AGENT_ACTION', payload)).not.toThrow();
            expect(first).toHaveBeenCalledWith(payload);
            expect(second).toHaveBeenCalledWith(payload);
            expect(warning).toHaveBeenCalledWith('[EventBus] AGENT_ACTION listener failed (Error)');
        } finally {
            offFirst();
            offSecond();
            warning.mockRestore();
        }
    });

    it('contains an async listener rejection without blocking other subscribers', async () => {
        const warning = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const first = vi.fn(async () => { throw new Error('private detail'); });
        const second = vi.fn();
        const offFirst = events.on('AGENT_ACTION', first);
        const offSecond = events.on('AGENT_ACTION', second);
        try {
            events.emit('AGENT_ACTION', { agentId: 'agent', action: 'start', details: 'private detail' });
            expect(second).toHaveBeenCalledTimes(1);
            await vi.waitFor(() => expect(warning).toHaveBeenCalledWith('[EventBus] AGENT_ACTION listener failed (Error)'));
        } finally {
            offFirst();
            offSecond();
            warning.mockRestore();
        }
    });

    it('uses a listener snapshot when subscriptions change during delivery', () => {
        const late = vi.fn();
        let offLate: (() => void) | undefined;
        const offFirst = events.on('TASK_COMPLETED', () => {
            offLate = events.on('TASK_COMPLETED', late);
        });
        try {
            events.emit('TASK_COMPLETED', {});
            expect(late).not.toHaveBeenCalled();
        } finally {
            offFirst();
            offLate?.();
        }
    });
});
