import { describe, expect, it } from 'vitest';
import { withOlderHistorySummary } from '@/services/agent/components/olderHistorySummary';

describe('withOlderHistorySummary (ISSUE-1661)', () => {
    it('puts the older-turn summary before the recent turns', () => {
        const out = withOlderHistorySummary('User: hi', 'Artist wants analog visuals.');
        expect(out.indexOf('Artist wants analog visuals.')).toBeLessThan(out.indexOf('User: hi'));
    });

    it('leaves history alone when there is no summary', () => {
        expect(withOlderHistorySummary('User: hi', '')).toBe('User: hi');
        expect(withOlderHistorySummary('User: hi', undefined)).toBe('User: hi');
    });
});
