/**
 * CurrencyConversionService
 * Handles conversion between different currencies for financial aggregation.
 *
 * Uses the free Frankfurter API (https://frankfurter.dev) powered by ECB data.
 * - No API key required
 * - 200+ currencies supported
 * - Rates updated daily by the European Central Bank
 *
 * Rates are cached for 6 hours to minimize API calls.
 */

import { logger } from '@/utils/logger';

// Frankfurter API — free, no auth, ECB data source
const FRANKFURTER_API = 'https://api.frankfurter.dev/v1/latest';

// Cache TTL: 6 hours in milliseconds
const RATE_CACHE_TTL = 6 * 60 * 60 * 1000;

export class CurrencyConversionService {
  // Base currency is USD
  // Rates are: 1 USD = X Currency
  private rates: Map<string, number> = new Map([
    ['USD', 1.0],
    ['EUR', 0.92],
    ['GBP', 0.77],
    ['JPY', 150.0],
    ['CAD', 1.35],
    ['AUD', 1.50],
    ['CNY', 7.20],
    ['INR', 83.0],
    ['BRL', 5.0],
    ['MXN', 17.0],
  ]);

  private lastFetchTime = 0;
  private fetchPromise: Promise<void> | null = null;

  constructor() { }

  /**
   * Convert an amount from one currency to another
   */
  async convert(amount: number, fromCurrency: string, toCurrency: string = 'USD'): Promise<number> {
    if (fromCurrency === toCurrency) return amount;
    if (amount === 0) return 0;

    // Ensure we have fresh rates
    await this.ensureFreshRates();

    const fromRate = this.getRate(fromCurrency);
    const toRate = this.getRate(toCurrency);

    if (fromRate === undefined || toRate === undefined) {
      // If we don't know the currency, return original amount with 1:1 conversion
      // This is a fallback for unknown currencies - not ideal but prevents calculation errors
      logger.warn(`[CurrencyConversion] Unknown currency: ${fromCurrency} or ${toCurrency}, using 1:1`);
      return amount;
    }

    // Convert to USD first (Amount / Rate = USD value)
    // Example: 100 EUR / 0.92 = 108.69 USD
    const amountInUSD = amount / fromRate;

    // Convert from USD to target (USD value * Target Rate)
    // Example: 108.69 USD * 150 = 16303.5 JPY
    return amountInUSD * toRate;
  }

  /**
   * Get exchange rate for a currency (relative to USD)
   */
  private getRate(currency: string): number | undefined {
    return this.rates.get(currency.toUpperCase());
  }

  /**
   * Ensure we have rates fetched within the cache TTL window.
   * Deduplicates concurrent fetch requests.
   */
  private async ensureFreshRates(): Promise<void> {
    const now = Date.now();
    if (now - this.lastFetchTime < RATE_CACHE_TTL) return;

    // Deduplicate: if a fetch is already in progress, wait for it
    if (this.fetchPromise) {
      await this.fetchPromise;
      return;
    }

    this.fetchPromise = this.updateRates();
    try {
      await this.fetchPromise;
    } finally {
      this.fetchPromise = null;
    }
  }

  /**
   * Fetch live exchange rates from the Frankfurter API (ECB data, free, no auth).
   * Rates are relative to USD. Falls back to existing cached rates on failure.
   */
  async updateRates(): Promise<void> {
    try {
      const response = await fetch(`${FRANKFURTER_API}?base=USD`);

      if (!response.ok) {
        throw new Error(`Frankfurter API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as {
        base: string;
        date: string;
        rates: Record<string, number>;
      };

      if (!data.rates || typeof data.rates !== 'object') {
        throw new Error('Invalid API response: missing rates object');
      }

      // Update the rates map with live data
      this.rates.set('USD', 1.0); // Base is always 1
      for (const [currency, rate] of Object.entries(data.rates)) {
        if (typeof rate === 'number' && rate > 0) {
          this.rates.set(currency.toUpperCase(), rate);
        }
      }

      this.lastFetchTime = Date.now();
      logger.info(`[CurrencyConversion] Updated ${Object.keys(data.rates).length} exchange rates (ECB date: ${data.date})`);
    } catch (error) {
      logger.warn('[CurrencyConversion] Failed to fetch live rates, using cached/default rates:', error);
      // Don't update lastFetchTime — retry on next call
    }
  }

  /**
   * Get all available currency codes
   */
  getAvailableCurrencies(): string[] {
    return Array.from(this.rates.keys()).sort();
  }

  /**
   * Get the age of the current rate cache in milliseconds.
   * Returns Infinity if rates have never been fetched live.
   */
  getCacheAge(): number {
    if (this.lastFetchTime === 0) return Infinity;
    return Date.now() - this.lastFetchTime;
  }
}

export const currencyConversionService = new CurrencyConversionService();
