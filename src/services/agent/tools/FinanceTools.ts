import { AI_MODELS } from '@/core/config/ai-models';
import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

export const FinanceTools: Record<string, AnyToolFunction> = {
    analyze_receipt: wrapTool('analyze_receipt', async (args: { image_data: string, mime_type: string }) => {
        const { firebaseAI } = await import('@/services/ai/FirebaseAIService');

        // Construct Multimodal Prompt
        const prompt = `You are an expert accountant. Extract the following data from this receipt image:
        1. Vendor Name
        2. Date
        3. Total Amount
        4. Expense Category (Travel, Equipment, Meals, Marketing, Other)
        5. Brief Description
        
        Output strictly in JSON format: { "vendor": string, "date": string, "amount": number, "category": string, "description": string }`;

        const res = await firebaseAI.generateContent(
            [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: args.mime_type, data: args.image_data } }
                    ]
                }
            ],
            AI_MODELS.TEXT.AGENT
        );

        // Access the text from the response object
        const text = res.response.text();

        return {
            raw_data: text,
            message: "Receipt analysis completed."
        };
    }),

    audit_distribution: wrapTool('audit_distribution', async (args: { trackTitle: string; distributor: string }) => {
        const { DISTRIBUTORS } = await import('@/core/config/distributors');

        // 1. Check Distributor Config
        const distConfig = DISTRIBUTORS[args.distributor as keyof typeof DISTRIBUTORS];
        if (!distConfig) {
            return toolError(`Distributor '${args.distributor}' is not in the approved database.`, "UNKNOWN_DISTRIBUTOR");
        }

        return {
            status: "READY_FOR_AUDIT",
            distributor: distConfig.name,
            party_id: distConfig.ddexPartyId,
            message: `Distribution channel '${distConfig.name}' verified. Recipient Party ID: ${distConfig.ddexPartyId}. Ready to generate ERN.`
        };
    }),

    forecast_revenue: wrapTool('forecast_revenue', async (args: { currentStreams: number, platform: string, rightsHolderSplit: number }) => {
        // Industry average payout rates (approximate)
        const PAYOUT_RATES: Record<string, number> = {
            'Spotify': 0.004,
            'Apple Music': 0.008,
            'YouTube Music': 0.002,
            'Amazon Music': 0.004,
            'Tidal': 0.013,
            'Deezer': 0.006,
            'Pandora': 0.001,
            'Other': 0.003
        };

        const rate = PAYOUT_RATES[args.platform] || PAYOUT_RATES['Other'];
        const gross = args.currentStreams * rate;

        // Standard management fee is ~20%
        const MANAGER_FEE_PERCENT = 0.20;

        const projections = {
            month_1: gross,
            month_6: gross * 6,
            year_1: gross * 12
        };

        const managerFeeSaved = {
            month_1: projections.month_1 * MANAGER_FEE_PERCENT,
            month_6: projections.month_6 * MANAGER_FEE_PERCENT,
            year_1: projections.year_1 * MANAGER_FEE_PERCENT
        };

        const netRevenue = {
            month_1: projections.month_1 * (args.rightsHolderSplit / 100),
            month_6: projections.month_6 * (args.rightsHolderSplit / 100),
            year_1: projections.year_1 * (args.rightsHolderSplit / 100)
        };

        return toolSuccess({
            platform: args.platform,
            rate_per_stream: rate,
            projections: {
                gross: projections,
                manager_fee_saved: managerFeeSaved,
                net_to_rights_holder: netRevenue
            },
            message: `Revenue forecast generated for ${args.currentStreams} streams on ${args.platform}. Estimated annual savings on manager fees: $${managerFeeSaved.year_1.toFixed(2)}.`
        }, `Revenue forecast generated.`);
    }),

    generate_schedule_c: wrapTool('generate_schedule_c', async (args: { taxYear: number; totalIncome: number; totalExpenses: number; ownerName: string }) => {
        // Simple mock of a Schedule C generation
        const netProfit = args.totalIncome - args.totalExpenses;
        const taxPrepMode = "Active";

        return toolSuccess({
            taxYear: args.taxYear,
            ownerName: args.ownerName,
            grossReceipts: args.totalIncome,
            totalExpenses: args.totalExpenses,
            netProfitOrLoss: netProfit,
            formType: 'Schedule C (Form 1040)',
            taxPrepMode
        }, `Schedule C draft generated for ${args.ownerName} (Tax Year ${args.taxYear}). Net Profit: $${netProfit.toFixed(2)}`);
    }),

    calculate_waterfall: wrapTool('calculate_waterfall', async (args: { trackTitle: string; totalRevenue: number; payees: Array<{ name: string; percentage: number; is1099Eligible: boolean }> }) => {
        // Validation
        const totalPercentage = args.payees.reduce((acc, p) => acc + p.percentage, 0);
        if (Math.abs(totalPercentage - 100) > 0.01) {
            return toolError("Payee percentages must sum to 100%.", "INVALID_SPLIT");
        }

        const waterfall = args.payees.map(p => {
            const payout = args.totalRevenue * (p.percentage / 100);
            return {
                name: p.name,
                percentage: p.percentage,
                payout,
                requires1099: p.is1099Eligible && payout >= 600 // Tagging 1099-worthy payouts
            };
        });

        const total1099s = waterfall.filter(w => w.requires1099).length;

        return toolSuccess({
            trackTitle: args.trackTitle,
            totalRevenue: args.totalRevenue,
            waterfall,
            flags: {
                total1099FormsRequired: total1099s
            }
        }, `Waterfall calculated for "${args.trackTitle}". Total Revenue: $${args.totalRevenue}. Flagged ${total1099s} payouts for 1099 processing.`);
    })
};
