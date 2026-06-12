import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinanceAgent } from './FinanceAgent';

// Mock prompt.md?raw
vi.mock('@agents/finance/prompt.md?raw', () => ({
    default: 'Mock System Prompt'
}));

// Mock AutonomousIntelligence
vi.mock('@/services/intelligence/AutonomousIntelligence', () => {
    return {
        AutonomousIntelligence: {
            generateText: vi.fn().mockResolvedValue('Mock Financial Answer'),
            generateContent: vi.fn().mockResolvedValue({
                response: {
                    text: () => '{"vendor": "Store", "total": 150}'
                }
            })
        }
    };
});

describe('FinanceAgent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should have the correct ID and metadata', () => {
        expect(FinanceAgent.id).toBe('finance');
        expect(FinanceAgent.name).toBe('Finance Director');
        expect(FinanceAgent.category).toBe('department');
    });

    describe('analyze_budget', () => {
        it('should calculate budget and manager fee saved correctly', async () => {
            const args = { amount: 10000, breakdown: 'Travel' };
            const result = await FinanceAgent.functions!.analyze_budget(args);
            expect(result.success).toBe(true);
            expect(result.data?.dividend_saved).toBe(2000);
        });
    });

    describe('forecast_revenue', () => {
        it('should calculate projections over N months', async () => {
            const args = { current_monthly_streams: 100000, growth_rate_percent: 10, months: 6 };
            const result = await FinanceAgent.functions!.forecast_revenue(args);
            expect(result.success).toBe(true);
            expect(result.data?.summary.months).toBe(6);
            expect(result.data?.projections.length).toBe(6);
        });
    });

    describe('generate_tax_report', () => {
        it('should flag transactions >= $600', async () => {
            const args = {
                year: 2026,
                transactions: [
                    { payee: 'Writer A', amount: 500, date: '2026-01-01' },
                    { payee: 'Writer B', amount: 700, date: '2026-02-01' }
                ]
            };
            const result = await FinanceAgent.functions!.generate_tax_report(args);
            expect(result.success).toBe(true);
            expect(result.data?.flagged_for_1099).toBe(1);
        });
    });
});
