
import { describe, it, expect } from 'vitest';
import { smartContractService } from './SmartContractService';

describe('SmartContractService', () => {
    it('should deploy a split contract and return an address', async () => {
        const address = await smartContractService.deploySplitContract({
            isrc: 'US-XYZ-26-00001',
            payees: [
                { walletAddress: '0xA', percentage: 50, role: 'Artist' },
                { walletAddress: '0xB', percentage: 50, role: 'Label' }
            ]
        });
        expect(address).toMatch(/^0x/);
        expect(address.length).toBeGreaterThan(10);
    });

    it('should throw error for invalid split percentages', async () => {
        await expect(smartContractService.deploySplitContract({
            isrc: 'US-FAIL',
            payees: [
                { walletAddress: '0xA', percentage: 50, role: 'Artist' },
                { walletAddress: '0xB', percentage: 40, role: 'Label' } // Total 90
            ]
        })).rejects.toThrow('Invalid Split Configuration');
    });

    it('should record transactions to the immutable ledger', async () => {
        const isrc = 'US-LEDGER-TEST';
        await smartContractService.deploySplitContract({
            isrc,
            payees: [{ walletAddress: '0xA', percentage: 100, role: 'Solo' }]
        });

        const history = await smartContractService.getChainOfCustody(isrc);
        expect(history).toHaveLength(1);
        expect(history[0].action).toBe('SPLIT_EXECUTION');
        expect(history[0].hash).toBeDefined();
    });

    it('should mint tokens (SongShares)', async () => {
        const tokenAddr = await smartContractService.tokenizeAsset('US-TOKEN', 100);
        expect(tokenAddr).toMatch(/^0xToken/);

        const history = await smartContractService.getChainOfCustody('US-TOKEN');
        expect(history[0].action).toBe('TOKEN_MINT');
    });
});
