import { describe, it, expect } from 'vitest';
import { describeBulkReleaseResult, runBulkReleaseAction } from './bulkReleaseAction';

describe('runBulkReleaseAction', () => {
    it('keeps the releases that were changed when another one fails', async () => {
        const result = await runBulkReleaseAction(['a', 'b', 'c'], async id => {
            if (id === 'b') throw new Error('permission denied');
        });
        expect(result).toEqual({ succeeded: ['a', 'c'], failed: ['b'] });
    });

    it('attempts every release even after a failure', async () => {
        const seen: string[] = [];
        await runBulkReleaseAction(['a', 'b', 'c'], async id => { seen.push(id); throw new Error('x'); });
        expect(seen).toEqual(['a', 'b', 'c']);
    });
});

describe('describeBulkReleaseResult', () => {
    it('reports full success', () => {
        expect(describeBulkReleaseResult('delete', { succeeded: ['a', 'b'], failed: [] }))
            .toEqual({ level: 'success', message: '2 releases deleted.' });
    });

    it('reports total failure without claiming any change', () => {
        expect(describeBulkReleaseResult('archive', { succeeded: [], failed: ['a'] }))
            .toEqual({ level: 'error', message: 'Could not archive 1 release.' });
    });

    it('says exactly what happened on a partial failure', () => {
        const { level, message } = describeBulkReleaseResult('delete', { succeeded: ['a'], failed: ['b', 'c'] });
        expect(level).toBe('error');
        expect(message).toBe('1 release deleted; 2 could not be deleted and are still selected.');
    });
});
