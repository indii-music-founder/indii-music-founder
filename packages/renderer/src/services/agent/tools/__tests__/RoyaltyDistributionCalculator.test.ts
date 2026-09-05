import { describe, it, expect } from 'vitest';
import { FinanceTools } from '../FinanceTools';

describe('FinanceTools - royalty_distribution_calculator', () => {
    const calc = FinanceTools.royalty_distribution_calculator;

    it('calculates standard 50/50 split cleanly with 0 fees and 0 expenses', async () => {
        const result = await calc({
            trackTitle: 'Midnight Skyline',
            grossRevenue: 1000,
            currency: 'USD',
            parties: [
                { name: 'Alice (Producer)', role: 'Producer', percentage: 50 },
                { name: 'Bob (Artist)', role: 'Artist', percentage: 50 }
            ]
        });

        expect(result.success).toBe(true);
        expect(result.data.summary.grossRevenue).toBe(1000);
        expect(result.data.summary.distributionFeeAmount).toBe(0);
        expect(result.data.summary.totalRecoupableExpenses).toBe(0);
        expect(result.data.summary.distributablePool).toBe(1000);
        expect(result.data.summary.totalNetPayable).toBe(1000);
        expect(result.data.summary.isFullyRecouped).toBe(true);

        expect(result.data.partyDistributions).toHaveLength(2);
        expect(result.data.partyDistributions[0].name).toBe('Alice (Producer)');
        expect(result.data.partyDistributions[0].netPayable).toBe(500);
        expect(result.data.partyDistributions[0].requires1099).toBe(false); // < $600

        expect(result.data.partyDistributions[1].name).toBe('Bob (Artist)');
        expect(result.data.partyDistributions[1].netPayable).toBe(500);
        expect(result.data.partyDistributions[1].requires1099).toBe(false);
    });

    it('deducts distribution fee off the top and flags 1099 tax thresholds', async () => {
        const result = await calc({
            trackTitle: 'Neon Highway',
            grossRevenue: 2000,
            distributionFeePercent: 15, // 15% distro fee = $300
            parties: [
                { name: 'Lead Artist', role: 'Artist', percentage: 70 }, // 70% of $1700 = $1190
                { name: 'Beat Producer', role: 'Producer', percentage: 30 } // 30% of $1700 = $510
            ]
        });

        expect(result.success).toBe(true);
        expect(result.data.summary.grossRevenue).toBe(2000);
        expect(result.data.summary.distributionFeeAmount).toBe(300);
        expect(result.data.summary.postDistributorRevenue).toBe(1700);
        expect(result.data.summary.distributablePool).toBe(1700);

        const artist = result.data.partyDistributions.find((p: any) => p.name === 'Lead Artist');
        expect(artist.netPayable).toBe(1190);
        expect(artist.requires1099).toBe(true); // >= $600 threshold

        const producer = result.data.partyDistributions.find((p: any) => p.name === 'Beat Producer');
        expect(producer.netPayable).toBe(510);
        expect(producer.requires1099).toBe(false); // < $600 threshold

        expect(result.data.compliance.total1099FormsRequired).toBe(1);
    });

    it('correctly handles recoupable expenses before split distribution', async () => {
        const result = await calc({
            trackTitle: 'Gold Rush',
            grossRevenue: 5000,
            distributionFeePercent: 10, // $500 fee -> $4500 post-distro
            recoupableExpenses: [
                { category: 'Studio Recording', amount: 1500 },
                { category: 'Mastering', amount: 500 }
            ], // Total expenses: $2000 -> Distributable pool: $2500
            parties: [
                { name: 'Artist A', role: 'Artist', percentage: 50 },
                { name: 'Artist B', role: 'Artist', percentage: 50 }
            ]
        });

        expect(result.success).toBe(true);
        expect(result.data.summary.totalRecoupableExpenses).toBe(2000);
        expect(result.data.summary.expensesRecoupedThisPeriod).toBe(2000);
        expect(result.data.summary.remainingUnrecoupedExpenses).toBe(0);
        expect(result.data.summary.isFullyRecouped).toBe(true);
        expect(result.data.summary.distributablePool).toBe(2500);

        expect(result.data.partyDistributions[0].netPayable).toBe(1250);
        expect(result.data.partyDistributions[1].netPayable).toBe(1250);
    });

    it('halts payouts when recoupable expenses exceed post-distributor revenue', async () => {
        const result = await calc({
            trackTitle: 'Early Days',
            grossRevenue: 1000,
            distributionFeePercent: 0,
            recoupableExpenses: [
                { category: 'Music Video Production', amount: 2500 }
            ],
            parties: [
                { name: 'Solo Artist', role: 'Artist', percentage: 100 }
            ]
        });

        expect(result.success).toBe(true);
        expect(result.data.summary.expensesRecoupedThisPeriod).toBe(1000);
        expect(result.data.summary.remainingUnrecoupedExpenses).toBe(1500);
        expect(result.data.summary.isFullyRecouped).toBe(false);
        expect(result.data.summary.distributablePool).toBe(0);
        expect(result.data.summary.totalNetPayable).toBe(0);
        expect(result.data.partyDistributions[0].netPayable).toBe(0);
    });

    it('recoups individual party advances and tracks remaining balances', async () => {
        const result = await calc({
            trackTitle: 'Collaboration Track',
            grossRevenue: 4000,
            parties: [
                {
                    name: 'Singer',
                    role: 'Artist',
                    percentage: 50, // $2000 share, $500 advance -> $1500 net
                    advancePaid: 500
                },
                {
                    name: 'Producer',
                    role: 'Producer',
                    percentage: 50, // $2000 share, $3000 advance -> $0 net, $1000 unrecouped
                    advancePaid: 3000
                }
            ]
        });

        expect(result.success).toBe(true);

        const singer = result.data.partyDistributions.find((p: any) => p.name === 'Singer');
        expect(singer.allocatedGross).toBe(2000);
        expect(singer.advanceRecouped).toBe(500);
        expect(singer.advanceRemaining).toBe(0);
        expect(singer.netPayable).toBe(1500);

        const producer = result.data.partyDistributions.find((p: any) => p.name === 'Producer');
        expect(producer.allocatedGross).toBe(2000);
        expect(producer.advanceRecouped).toBe(2000);
        expect(producer.advanceRemaining).toBe(1000);
        expect(producer.netPayable).toBe(0);
    });

    it('applies tax withholding when specified for a party', async () => {
        const result = await calc({
            trackTitle: 'International Feature',
            grossRevenue: 2000,
            parties: [
                { name: 'Domestic Artist', role: 'Artist', percentage: 50 },
                {
                    name: 'Foreign Artist',
                    role: 'Featured Artist',
                    percentage: 50,
                    taxWithholdingPercent: 30 // 30% foreign withholding on $1000 = $300 tax -> $700 net
                }
            ]
        });

        expect(result.success).toBe(true);
        const foreign = result.data.partyDistributions.find((p: any) => p.name === 'Foreign Artist');
        expect(foreign.allocatedGross).toBe(1000);
        expect(foreign.taxWithheld).toBe(300);
        expect(foreign.netPayable).toBe(700);
    });

    describe('Validation and Error Handling', () => {
        it('rejects invalid split percentages not summing to 100%', async () => {
            const result = await calc({
                trackTitle: 'Bad Math',
                grossRevenue: 1000,
                parties: [
                    { name: 'A', role: 'Artist', percentage: 60 },
                    { name: 'B', role: 'Producer', percentage: 30 } // sums to 90%
                ]
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Party split percentages must sum to 100%');
            expect(result.metadata?.errorCode).toBe('INVALID_SPLIT_TOTAL');
        });

        it('rejects negative gross revenue', async () => {
            const result = await calc({
                trackTitle: 'Negative Revenue',
                grossRevenue: -500,
                parties: [{ name: 'A', role: 'Artist', percentage: 100 }]
            });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_GROSS_REVENUE');
        });

        it('rejects empty parties array', async () => {
            const result = await calc({
                trackTitle: 'No Parties',
                grossRevenue: 1000,
                parties: []
            });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('NO_PARTIES_PROVIDED');
        });

        it('rejects invalid distribution fee percentage >= 100%', async () => {
            const result = await calc({
                trackTitle: 'Excessive Fee',
                grossRevenue: 1000,
                distributionFeePercent: 105,
                parties: [{ name: 'A', role: 'Artist', percentage: 100 }]
            });

            expect(result.success).toBe(false);
            expect(result.metadata?.errorCode).toBe('INVALID_DISTRIBUTION_FEE');
        });
    });
});
