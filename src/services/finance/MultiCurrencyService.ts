import { logger } from '@/utils/logger';

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'BTC' | 'ETH';

export interface ExchangeRate {
    base: CurrencyCode;
    rates: Record<CurrencyCode, number>;
    updatedAt: string;
}

export class MultiCurrencyService {
    /** 
     * Mock rates for demonstration. 
     * In production, this would be updated via an external API like fixer.io or similar. 
     */
    private currentRates: ExchangeRate = {
        base: 'USD',
        rates: {
            'USD': 1.0,
            'EUR': 0.92,
            'GBP': 0.79,
            'JPY': 150.12,
            'AUD': 1.53,
            'CAD': 1.35,
            'BTC': 0.000015,
            'ETH': 0.00032
        },
        updatedAt: new Date().toISOString()
    };

    /**
     * Convert an amount between two currencies.
     */
    convert(amount: number, from: CurrencyCode, to: CurrencyCode): number {
        try {
            if (from === to) return amount;

            const fromRate = this.currentRates.rates[from];
            const toRate = this.currentRates.rates[to];

            if (!fromRate || !toRate) {
                logger.error(`[Currency] Invalid currency code: ${from} -> ${to}`);
                return amount;
            }

            // Convert to USD (base) then to target
            const usdAmount = amount / fromRate;
            const convertedAmount = usdAmount * toRate;

            logger.info(`[Currency] Converted ${amount} ${from} -> ${convertedAmount} ${to}`);
            return parseFloat(convertedAmount.toFixed(4));
        } catch (error) {
            logger.error('[Currency] Conversion failed:', error);
            return amount;
        }
    }

    /**
     * Format an amount as a localized currency string.
     */
    format(amount: number, currency: CurrencyCode, locale: string = 'en-US'): string {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: currency === 'BTC' || currency === 'ETH' ? 8 : 2
        }).format(amount);
    }
}

export const multiCurrencyService = new MultiCurrencyService();
