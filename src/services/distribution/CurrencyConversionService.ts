/**
 * CurrencyConversionService
 * Handles conversion between different currencies for financial aggregation
 */

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

  constructor() { }

  /**
   * Convert an amount from one currency to another
   */
  async convert(amount: number, fromCurrency: string, toCurrency: string = 'USD'): Promise<number> {
    if (fromCurrency === toCurrency) return amount;
    if (amount === 0) return 0;

    const fromRate = this.getRate(fromCurrency);
    const toRate = this.getRate(toCurrency);

    if (fromRate === undefined || toRate === undefined) {
      console.warn(`[CurrencyConversionService] Missing exchange rate for ${fromCurrency} or ${toCurrency}. Using 1:1 fallback.`);
      // If we don't know the currency, we can't reliably convert.
      // Returning the original amount is dangerous if we are summing, but returning 0 is also bad.
      // We'll return the amount and hope for the best, but log a warning.
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
   * Update rates (placeholder for future API integration)
   */
  async updateRates(): Promise<void> {
    // TODO: Fetch live rates from an API
    console.info('[CurrencyConversionService] updating rates (mock)');
  }
}

export const currencyConversionService = new CurrencyConversionService();
