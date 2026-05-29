import { logger } from '@/utils/logger';

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'BTC' | 'ETH';

export interface ExchangeRate {
    base: CurrencyCode;
    rates: Record<CurrencyCode, number>;
    updatedAt: string;
}

export class MultiCurrencyService {
    private currentRates: ExchangeRate | null = null;

    setRates(rates: ExchangeRate): void {
        this.currentRates = rates;
    }

    /**
     * Convert an amount between two currencies.
     */
    convert(amount: number, from: CurrencyCode, to: CurrencyCode): number {
        try {
            if (from === to) return amount;
            if (!this.currentRates) {
                throw new Error('Exchange rates are not configured.');
            }

            const fromRate = this.currentRates.rates[from];
            const toRate = this.currentRates.rates[to];

            if (!fromRate || !toRate) {
                logger.error(`[Currency] Invalid currency code: ${from} -> ${to}`);
                throw new Error(`Invalid or unavailable currency code: ${from} -> ${to}`);
            }

            // Convert to USD (base) then to target
            const usdAmount = amount / fromRate;
            const convertedAmount = usdAmount * toRate;

            logger.info(`[Currency] Converted ${amount} ${from} -> ${convertedAmount} ${to}`);
            return parseFloat(convertedAmount.toFixed(4));
        } catch (error: unknown) {
            logger.error('[Currency] Conversion failed:', error);
            throw error;
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
