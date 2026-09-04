/**
 * DecimalMoney — micro-unit (6-decimal) fixed-point money using BigInt.
 *
 * Internally every amount is stored as a BigInt scaled by 1_000_000
 * (i.e. one cent = 1_000_000 µ-units, one dollar = 100_000_000 µ-units).
 * This guarantees zero epsilon drift across splits and accumulations.
 */

const SCALE = 1_000_000n; // micro-units per cent
const CENTS_PER_DOLLAR = 100n;

export class DecimalMoney {
  /** Raw micro-unit value (private, immutable after construction). */
  private readonly _micro: bigint;

  private constructor(micro: bigint) {
    this._micro = micro;
  }

  // ---------------------------------------------------------------------------
  // Factories
  // ---------------------------------------------------------------------------

  /** Create from an integer cent amount (e.g. 150 = $1.50). */
  static fromCents(cents: number | bigint): DecimalMoney {
    const c = typeof cents === 'number' ? BigInt(Math.trunc(cents)) : cents;
    return new DecimalMoney(c * SCALE);
  }

  /**
   * Create from a floating-point dollar amount (e.g. 1.50 = $1.50).
   *
   * The float is first converted to a fixed-precision string with 6 decimal
   * places, then parsed digit-by-digit — **no** floating-point multiplication
   * touches the internal BigInt value.
   */
  static fromFloat(dollars: number): DecimalMoney {
    // toFixed(6) gives us a string like "1.500000" or "-0.003400"
    const str = dollars.toFixed(6);
    return DecimalMoney.fromString(str);
  }

  /**
   * Create from a string representation (e.g. "1.50", "-0.0034", "100").
   * Supports up to 6 decimal places of precision.
   */
  static fromString(value: string): DecimalMoney {
    const trimmed = value.trim();
    if (trimmed === '') {
      throw new Error('DecimalMoney.fromString: empty string');
    }

    const negative = trimmed.startsWith('-');
    const abs = negative ? trimmed.slice(1) : trimmed;
    const dotIndex = abs.indexOf('.');

    let intPart: string;
    let fracPart: string;

    if (dotIndex === -1) {
      intPart = abs;
      fracPart = '';
    } else {
      intPart = abs.slice(0, dotIndex);
      fracPart = abs.slice(dotIndex + 1);
    }

    if (fracPart.length > 6) {
      // Truncate beyond 6 decimals
      fracPart = fracPart.slice(0, 6);
    }

    // Pad fractional part to exactly 6 digits
    fracPart = fracPart.padEnd(6, '0');

    // intPart is in dollars — convert to micro-units:
    // micro = intPart * CENTS_PER_DOLLAR * SCALE + fracDigits-to-micro
    //
    // But simpler: combine into a single integer.
    // dollars.fraction  →  (intPart * 10^6 + fracPart) represents dollar-micro-units
    // Then multiply by 100 to get cent-micro-units.
    const wholeMicro = BigInt(intPart || '0') * 1_000_000n + BigInt(fracPart);
    // wholeMicro is in dollar-scale micro-units; multiply by 100 to get cent-scale
    const centMicro = wholeMicro * CENTS_PER_DOLLAR;

    return new DecimalMoney(negative ? -centMicro : centMicro);
  }

  /** Zero value. */
  static zero(): DecimalMoney {
    return new DecimalMoney(0n);
  }

  // ---------------------------------------------------------------------------
  // Arithmetic
  // ---------------------------------------------------------------------------

  add(other: DecimalMoney): DecimalMoney {
    return new DecimalMoney(this._micro + other._micro);
  }

  subtract(other: DecimalMoney): DecimalMoney {
    return new DecimalMoney(this._micro - other._micro);
  }

  /**
   * Multiply by a percentage expressed as a number (e.g. 0.15 = 15 %).
   *
   * Internally converts the percentage to basis-points (integer) to avoid
   * floating-point multiplication on the BigInt value.  The result is
   * rounded toward zero (truncation).
   */
  multiply(percentage: number): DecimalMoney {
    // Convert percentage to basis points with extra precision:
    // percentage 0.15 → 1500 bp (out of 10 000).
    // We use 10 decimal digits of precision via Math.round.
    const bpScaled = BigInt(Math.round(percentage * 1_000_000_000_000));
    const result = (this._micro * bpScaled) / 1_000_000_000_000n;
    return new DecimalMoney(result);
  }

  /** Negate the value. */
  negate(): DecimalMoney {
    return new DecimalMoney(-this._micro);
  }

  /** Absolute value. */
  abs(): DecimalMoney {
    return this._micro < 0n ? this.negate() : this;
  }

  // ---------------------------------------------------------------------------
  // Conversions
  // ---------------------------------------------------------------------------

  /**
   * Return the value as an integer number of cents, truncating any sub-cent
   * micro-units.
   */
  toCents(): number {
    return Number(this._micro / SCALE);
  }

  /** Return the value as a floating-point dollar amount. */
  toFloat(): number {
    // Convert micro-units → cents → dollars
    const cents = this._micro / SCALE;
    const remainderMicro = this._micro % SCALE;
    // Build the float from integer parts to minimise FP error
    return Number(cents) / 100 + Number(remainderMicro) / Number(SCALE) / 100;
  }

  /**
   * Return a human-readable string in dollar format with 2 decimal places
   * (e.g. "1.50", "-0.00").
   */
  toString(): string {
    const totalCents = this._micro / SCALE;
    const negative = totalCents < 0n;
    const absCents = negative ? -totalCents : totalCents;
    const dollars = absCents / CENTS_PER_DOLLAR;
    const centsRemainder = absCents % CENTS_PER_DOLLAR;
    const centsStr = centsRemainder.toString().padStart(2, '0');
    return `${negative ? '-' : ''}${dollars}.${centsStr}`;
  }

  /**
   * Return a precise string with up to 6 fractional-dollar digits
   * (e.g. "1.503400").
   */
  toExactString(): string {
    // Total in dollar-scale micro-units
    const dollarMicro = this._micro / CENTS_PER_DOLLAR;
    const negative = dollarMicro < 0n;
    const abs = negative ? -dollarMicro : dollarMicro;
    const intPart = abs / 1_000_000n;
    const fracPart = abs % 1_000_000n;
    const fracStr = fracPart.toString().padStart(6, '0');
    return `${negative ? '-' : ''}${intPart}.${fracStr}`;
  }

  // ---------------------------------------------------------------------------
  // Comparison
  // ---------------------------------------------------------------------------

  /** -1, 0, or 1. */
  compare(other: DecimalMoney): -1 | 0 | 1 {
    if (this._micro < other._micro) return -1;
    if (this._micro > other._micro) return 1;
    return 0;
  }

  equals(other: DecimalMoney): boolean {
    return this._micro === other._micro;
  }

  isZero(): boolean {
    return this._micro === 0n;
  }

  isNegative(): boolean {
    return this._micro < 0n;
  }

  isPositive(): boolean {
    return this._micro > 0n;
  }

  greaterThan(other: DecimalMoney): boolean {
    return this._micro > other._micro;
  }

  lessThan(other: DecimalMoney): boolean {
    return this._micro < other._micro;
  }

  greaterThanOrEqual(other: DecimalMoney): boolean {
    return this._micro >= other._micro;
  }

  lessThanOrEqual(other: DecimalMoney): boolean {
    return this._micro <= other._micro;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers (useful for tests / debugging)
  // ---------------------------------------------------------------------------

  /** Raw micro-unit BigInt (exposed for white-box tests). */
  get microUnits(): bigint {
    return this._micro;
  }
}
