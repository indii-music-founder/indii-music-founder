/** Pure validation/arithmetic tests; no network, account or customer fixtures. */
import { describe, expect, it } from 'vitest';
import { CurrencyConversionService, FxRateUnavailableError, parseFxSnapshot, assertFreshFxSnapshot, requirePositiveFxRate, normalizeCurrencyCode, RATE_CACHE_TTL, MAX_REFERENCE_AGE } from './CurrencyConversionService';

describe('CurrencyConversionService safe initial state', () => {
  it('has no invented market rates before a provider response', () => {
    const service = new CurrencyConversionService();
    expect(service.getAvailableCurrencies()).toEqual(['USD']);
    expect(service.getCacheAge()).toBe(Infinity);
  });

  it.each([NaN, Infinity, -Infinity])('rejects non-finite amounts without requesting rates (%s)', async amount => {
    await expect(new CurrencyConversionService().convert(amount, 'USD', 'USD')).rejects.toThrow();
  });

  it('rejects empty currency codes even for identical strings', async () => {
    await expect(new CurrencyConversionService().convert(1, '', '')).rejects.toThrow();
  });
});


describe('FX response validation and freshness policy (pure inputs)', () => {
  const now = Date.UTC(2026, 9, 28, 12);
  // Deliberately arbitrary arithmetic values, never substituted for a fetch
  // response and never asserted to be actual market quotes.
  const row = { base: 'USD', date: '2026-10-28', quote: 'EUR', rate: 2 };
  const input = [row, { ...row, quote: 'GBP', rate: 3 }];

  it('preserves quote provenance and makes stored rate evidence immutable', () => {
    const snapshot = parseFxSnapshot(input, now);
    expect(snapshot.source).toBe('https://api.frankfurter.dev/v2/providers/ecb/rates');
    expect(snapshot.base).toBe('USD');
    expect(snapshot.provider).toBe('ECB');
    expect(snapshot.rateDate).toBe(row.date);
    expect(snapshot.fetchedAt).toBe(now);
    expect(snapshot.rates).toEqual({ USD: 1, EUR: 2, GBP: 3 });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.rates)).toBe(true);
  });

  it('replaces quote tables rather than carrying unsupported old currencies forward', () => {
    const first = parseFxSnapshot(input, now);
    const replacement = parseFxSnapshot([{ ...row, quote: 'GBP', rate: 4 }], now);
    expect(first.rates.EUR).toBe(2);
    expect(replacement.rates.EUR).toBeUndefined();
  });

  it.each([
    null, [], {},
    { amount: 1, base: 'USD', date: row.date, rates: { EUR: 2 } }, // v1 is not the v2 contract
    [null], [[]],
    [{ ...row, base: 'EUR' }],
    [{ ...row, date: '' }],
    [{ ...row, date: '2026-02-30' }],
    [{ ...row, date: '2026-10-29' }],
    [{ ...row, date: '2026-10-20' }],
    [{ ...row, rate: NaN }],
    [{ ...row, rate: Infinity }],
    [{ ...row, rate: 0 }],
    [{ ...row, rate: -2 }],
    [row, { ...row, quote: 'GBP', rate: '3' }],
    [{ ...row, quote: 'eur' }],
    [{ ...row, quote: 'USD', rate: 2 }],
    [{ ...row, quote: 'USD', rate: 1 }],
    [row, { ...row, rate: 3 }],
    [row, { ...row, quote: 'GBP', date: '2026-10-27' }],
  ])('rejects invalid or stale quote structures (%j)', raw => {
    expect(() => parseFxSnapshot(raw, now)).toThrow(FxRateUnavailableError);
  });

  it.each([NaN, Infinity, 0, -1, 1.5])('rejects invalid fetch timestamps (%s)', fetchedAt => {
    expect(() => parseFxSnapshot(input, fetchedAt)).toThrow(FxRateUnavailableError);
  });

  it('expires the cache exactly at its six-hour boundary', () => {
    const snapshot = parseFxSnapshot(input, now);
    expect(() => assertFreshFxSnapshot(snapshot, now + RATE_CACHE_TTL - 1)).not.toThrow();
    expect(() => assertFreshFxSnapshot(snapshot, now + RATE_CACHE_TTL)).toThrow(FxRateUnavailableError);
  });

  it('rejects clock rollback and non-finite clocks', () => {
    const snapshot = parseFxSnapshot(input, now);
    expect(() => assertFreshFxSnapshot(snapshot, now - 1)).toThrow(FxRateUnavailableError);
    expect(() => assertFreshFxSnapshot(snapshot, NaN)).toThrow(FxRateUnavailableError);
  });

  it('allows weekend reference dates but refuses a newly fetched week-old quote', () => {
    const monday = Date.UTC(2026, 9, 26, 12);
    const friday = input.map(item => ({ ...item, date: '2026-10-23' }));
    expect(() => parseFxSnapshot(friday, monday)).not.toThrow();
    expect(() => parseFxSnapshot(friday, Date.UTC(2026, 9, 23) + MAX_REFERENCE_AGE)).toThrow(FxRateUnavailableError);
  });

  it.each([undefined, null, NaN, Infinity, -Infinity, 0, -1, '1'])('rejects unusable conversion factors (%s)', rate => {
    expect(() => requirePositiveFxRate(rate)).toThrow(FxRateUnavailableError);
  });

  it('normalizes currency codes without inventing a market quote', () => {
    expect(normalizeCurrencyCode(' eur ')).toBe('EUR');
    expect(requirePositiveFxRate(3 / 2)).toBe(1.5);
  });

  it('uses mathematical identity for the same currency without provider data', async () => {
    const service = new CurrencyConversionService();
    expect(await service.convert(-12, ' usd ', 'USD')).toBe(-12);
    expect(await service.getQuote('eur', 'EUR')).toEqual({
      fromCurrency: 'EUR', toCurrency: 'EUR', rate: 1,
      source: 'same-currency', provider: null, rateDate: null, fetchedAt: null, expiresAt: null,
    });
    expect(service.getRateSnapshot()).toBeNull();
    expect(service.getCacheAge()).toBe(Infinity);
  });
});
