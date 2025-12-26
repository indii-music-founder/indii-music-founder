import { describe, it, expect } from 'vitest';
import { FinanceTools } from './tools/FinanceTools';

describe('Finance Agent Integration', () => {
    it('should audit distribution for a valid distributor', async () => {
        const result = await FinanceTools.audit_distribution({
            trackTitle: 'Test Song',
            distributor: 'distrokid'
        });

        const data = JSON.parse(result);
        expect(data.status).toBe('READY_FOR_AUDIT');
        expect(data.distributor).toBe('DistroKid');
        expect(data.party_id).toBeDefined();
    });

    it('should return error for unknown distributor', async () => {
        const result = await FinanceTools.audit_distribution({
            trackTitle: 'Test Song',
            distributor: 'fake_distro'
        });

        const data = JSON.parse(result);
        expect(data.status).toBe('UNKNOWN_DISTRIBUTOR');
        expect(data.risk).toBe('HIGH');
    });
});
