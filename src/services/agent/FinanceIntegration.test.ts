import { describe, it, expect } from 'vitest';
import { FinanceTools } from './tools/FinanceTools';

describe('Finance Agent Integration', () => {
    it('should audit distribution for a valid distributor', async () => {
        const result = await FinanceTools.audit_distribution({
            trackTitle: 'Test Song',
            distributor: 'distrokid'
        });

        const data = result.data;
        expect(data.status).toBe('READY_FOR_AUDIT');
        expect(data.distributor).toBe('DistroKid');
        expect(data.party_id).toBeDefined();
    });

    it('should return error for unknown distributor', async () => {
        const result = await FinanceTools.audit_distribution({
            trackTitle: 'Test Song',
            distributor: 'fake_distro'
        });

        // When toolError is returned, data might be undefined or contain error info depending on wrapTool
        // But likely it enters the error flow? 
        // Logic check: toolError usually returns { success: false, error: ... }
        // Let's see expectation: status 'UNKNOWN_DISTRIBUTOR'.
        // If toolError returns that structure in data or error.
        const data = result.data || result;
        expect(data.status).toBe('UNKNOWN_DISTRIBUTOR');
        expect(data.risk).toBe('HIGH');
    });
});
