import { logger } from '@/utils/logger';

export interface WaterfallConfig {
    artistSplit: number; // 0-1 (e.g., 0.5 for 50/50)
    labelSplit: number;  // 0-1
    recoupableExpenses: number; // Total un-recouped cost (production, marketing, etc.)
    recoupmentPriority: 'split' | 'direct'; // 'split' = recoup from artist share | 'direct' = recoup from gross
    featuredArtistSplits: Record<string, number>; // Featured artist percentages
}

export interface WaterfallResult {
    grossRevenue: number;
    recoupedAmount: number;
    remainingRecoupable: number;
    artistShare: number;
    labelShare: number;
    featuredShares: Record<string, number>;
    netArtistPayable: number;
}

export class WaterfallEngine {
    /**
     * Calculate payouts based on revenue and recoupment logic.
     */
    calculate(grossRevenue: number, config: WaterfallConfig): WaterfallResult {
        let recoupedAmount = 0;
        let remainingRecoupable = config.recoupableExpenses;
        let shareableRevenue = 0;

        // Determine how recoupment is handled
        if (config.recoupmentPriority === 'direct') {
            // Recoup FIRST from gross revenue
            recoupedAmount = Math.min(grossRevenue, config.recoupableExpenses);
            remainingRecoupable = config.recoupableExpenses - recoupedAmount;
            shareableRevenue = grossRevenue - recoupedAmount;
        } else {
            // Default: "Recoup from Artist share" logic is common but complex
            // Here, we'll assume the standard label-friendly "Recoup against all royalties" model
            recoupedAmount = Math.min(grossRevenue, config.recoupableExpenses);
            remainingRecoupable = config.recoupableExpenses - recoupedAmount;
            shareableRevenue = grossRevenue - recoupedAmount;
        }

        const artistShare = shareableRevenue * config.artistSplit;
        const labelShare = shareableRevenue * config.labelSplit;

        // Featured artist splits (usually subsets of the Artist share unless otherwise specified)
        const featuredShares: Record<string, number> = {};
        let netArtistPayable = artistShare;

        for (const [artistId, split] of Object.entries(config.featuredArtistSplits)) {
            const share = artistShare * split;
            featuredShares[artistId] = share;
            netArtistPayable -= share;
        }

        const result: WaterfallResult = {
            grossRevenue,
            recoupedAmount,
            remainingRecoupable,
            artistShare,
            labelShare,
            featuredShares,
            netArtistPayable
        };

        logger.info('[WaterfallEngine] Calc complete:', JSON.stringify(result));
        return result;
    }
}

export const waterfallEngine = new WaterfallEngine();
