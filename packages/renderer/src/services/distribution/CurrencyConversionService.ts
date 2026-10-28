/**
 * Currency conversion for earnings aggregation using Frankfurter's v2 ECB USD
 * reference-rate feed. No API key is required. The provider returns the latest
 * working day's rates, not intraday trading or payment settlement quotes.
 * https://frankfurter.dev/#rates-by-provider
 */
import { logger } from '@/utils/logger';

const FRANKFURTER_API = 'https://api.frankfurter.dev/v2/providers/ecb/rates';
export const RATE_CACHE_TTL = 6 * 60 * 60 * 1000;
// Local safety policy, allowing weekends/holidays without accepting an
// indefinitely old upstream snapshot just because it was fetched recently.
export const MAX_REFERENCE_AGE = 7 * 24 * 60 * 60 * 1000;

export class FxRateUnavailableError extends Error {
  readonly code = 'FX_RATE_UNAVAILABLE';
  constructor(detail: string) {
    super(`Exchange rates unavailable: ${detail}`);
    this.name = 'FxRateUnavailableError';
  }
}

export interface FxRateSnapshot {
  readonly source: typeof FRANKFURTER_API;
  readonly provider: 'ECB';
  readonly base: 'USD';
  readonly rateDate: string;
  readonly fetchedAt: number;
  readonly rates: Readonly<Record<string, number>>;
}

export interface CurrencyConversionQuote {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: string;
  provider: 'ECB' | null;
  rateDate: string | null;
  fetchedAt: number | null;
  expiresAt: number | null;
}

export function normalizeCurrencyCode(value: string): string {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value.trim().toUpperCase())) {
    throw new FxRateUnavailableError('a three-letter currency code is required.');
  }
  return value.trim().toUpperCase();
}

export function requirePositiveFxRate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new FxRateUnavailableError('a finite positive conversion rate is required.');
  }
  return value;
}

function referenceDate(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new FxRateUnavailableError('the provider quote date is missing or invalid.');
  }
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new FxRateUnavailableError('the provider quote date is invalid.');
  }
  return timestamp;
}

/** Validate a complete response before replacing the cache; never merge it with old rates. */
export function parseFxSnapshot(raw: unknown, fetchedAt: number): FxRateSnapshot {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new FxRateUnavailableError('the provider response must be a nonempty v2 rate array.');
  }
  if (!Number.isSafeInteger(fetchedAt) || fetchedAt <= 0) {
    throw new FxRateUnavailableError('the fetch timestamp is invalid.');
  }
  const rates: Record<string, number> = { USD: 1 };
  const seen = new Set<string>();
  let rateDate: string | undefined;
  for (const row of raw) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new FxRateUnavailableError('the provider rate row is invalid.');
    }
    const data = row as Record<string, unknown>;
    if (data.base !== 'USD' || typeof data.quote !== 'string' || !/^[A-Z]{3}$/.test(data.quote)) {
      throw new FxRateUnavailableError('the provider must return USD-base rows with valid quote currencies.');
    }
    referenceDate(data.date);
    if (rateDate !== undefined && rateDate !== data.date) {
      throw new FxRateUnavailableError('the provider returned inconsistent quote dates.');
    }
    rateDate = data.date as string;
    if (seen.has(data.quote) || (data.quote === 'USD' && data.rate !== 1)) {
      throw new FxRateUnavailableError('the provider returned duplicate currencies or an invalid USD identity.');
    }
    seen.add(data.quote);
    rates[data.quote] = requirePositiveFxRate(data.rate);
  }
  if (Object.keys(rates).length < 2) {
    throw new FxRateUnavailableError('the provider returned no foreign-currency rates.');
  }
  const snapshot: FxRateSnapshot = Object.freeze({
    source: FRANKFURTER_API,
    provider: 'ECB',
    base: 'USD',
    rateDate: rateDate!,
    fetchedAt,
    rates: Object.freeze(rates),
  });
  assertFreshFxSnapshot(snapshot, fetchedAt);
  return snapshot;
}

export function assertFreshFxSnapshot(snapshot: FxRateSnapshot, now: number): void {
  const referenceAge = now - referenceDate(snapshot.rateDate);
  const cacheAge = now - snapshot.fetchedAt;
  if (!Number.isSafeInteger(now) || now <= 0 || !Number.isSafeInteger(snapshot.fetchedAt) ||
      cacheAge < 0 || cacheAge >= RATE_CACHE_TTL || referenceAge < 0 || referenceAge >= MAX_REFERENCE_AGE) {
    throw new FxRateUnavailableError('the cached quote is expired, future-dated or too old.');
  }
}

export class CurrencyConversionService {
  private snapshot: FxRateSnapshot | null = null;
  private fetchPromise: Promise<void> | null = null;

  async convert(amount: number, fromCurrency: string, toCurrency = 'USD'): Promise<number> {
    if (!Number.isFinite(amount)) throw new RangeError('Conversion amount must be finite.');
    const quote = await this.getQuote(fromCurrency, toCurrency);
    const converted = amount * quote.rate;
    if (!Number.isFinite(converted)) throw new RangeError('Converted amount is outside the finite numeric range.');
    return converted;
  }

  /** Explicit provenance for callers displaying a converted estimate. */
  async getQuote(fromCurrency: string, toCurrency = 'USD'): Promise<CurrencyConversionQuote> {
    const from = normalizeCurrencyCode(fromCurrency);
    const to = normalizeCurrencyCode(toCurrency);
    if (from === to) {
      return { fromCurrency: from, toCurrency: to, rate: 1, source: 'same-currency', provider: null, rateDate: null, fetchedAt: null, expiresAt: null };
    }
    let snapshot = this.getRateSnapshot();
    if (!snapshot) {
      await this.updateRates();
      snapshot = this.getRateSnapshot();
    }
    if (!snapshot) throw new FxRateUnavailableError('no current provider quote is available.');
    const fromRate = snapshot.rates[from];
    const toRate = snapshot.rates[to];
    if (fromRate === undefined || toRate === undefined) {
      throw new FxRateUnavailableError(`${from}/${to} is not supported by the provider snapshot dated ${snapshot.rateDate}.`);
    }
    const rate = requirePositiveFxRate(toRate / fromRate);
    return {
      fromCurrency: from, toCurrency: to, rate,
      source: snapshot.source, provider: snapshot.provider, rateDate: snapshot.rateDate, fetchedAt: snapshot.fetchedAt,
      expiresAt: Math.min(snapshot.fetchedAt + RATE_CACHE_TTL, referenceDate(snapshot.rateDate) + MAX_REFERENCE_AGE),
    };
  }

  /** Expired snapshots are never exposed as usable quotes. */
  getRateSnapshot(): FxRateSnapshot | null {
    if (!this.snapshot) return null;
    try {
      assertFreshFxSnapshot(this.snapshot, Date.now());
      return this.snapshot;
    } catch {
      return null;
    }
  }

  /** Single-flight refresh, including direct updateRates callers. */
  async updateRates(): Promise<void> {
    if (this.fetchPromise) return this.fetchPromise;
    this.fetchPromise = this.fetchSnapshot();
    try {
      await this.fetchPromise;
    } finally {
      this.fetchPromise = null;
    }
  }

  private async fetchSnapshot(): Promise<void> {
    // An unsuccessful explicit refresh must not leave a stale/default quote usable.
    this.snapshot = null;
    try {
      const response = await fetch(`${FRANKFURTER_API}?base=USD`, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new FxRateUnavailableError(`Frankfurter returned HTTP ${response.status}.`);
      this.snapshot = parseFxSnapshot(await response.json(), Date.now());
      logger.info(`[CurrencyConversion] Loaded reference rates dated ${this.snapshot.rateDate}.`);
    } catch (error: unknown) {
      this.snapshot = null;
      const unavailable = error instanceof FxRateUnavailableError
        ? error : new FxRateUnavailableError('the provider request failed; conversion was not performed.');
      logger.warn('[CurrencyConversion] Quote unavailable:', unavailable.message);
      throw unavailable;
    }
  }

  getAvailableCurrencies(): string[] {
    return Object.keys(this.getRateSnapshot()?.rates ?? { USD: 1 }).sort();
  }

  getCacheAge(): number {
    if (!this.snapshot) return Infinity;
    const age = Date.now() - this.snapshot.fetchedAt;
    return age < 0 ? Infinity : age;
  }
}

export const currencyConversionService = new CurrencyConversionService();
