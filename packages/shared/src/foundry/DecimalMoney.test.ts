import { describe, it, expect } from 'vitest';
import { DecimalMoney } from './DecimalMoney';

// =============================================================================
// Factories
// =============================================================================

describe('DecimalMoney — factories', () => {
  it('fromCents creates the correct value', () => {
    const m = DecimalMoney.fromCents(150);
    expect(m.toCents()).toBe(150);
    expect(m.toFloat()).toBeCloseTo(1.50, 10);
  });

  it('fromCents accepts bigint', () => {
    const m = DecimalMoney.fromCents(200n);
    expect(m.toCents()).toBe(200);
  });

  it('fromFloat creates the correct value', () => {
    const m = DecimalMoney.fromFloat(1.50);
    expect(m.toCents()).toBe(150);
  });

  it('fromFloat handles sub-cent precision', () => {
    const m = DecimalMoney.fromFloat(0.005);
    // $0.005 = 0.5 cents — toCents truncates to 0
    expect(m.toCents()).toBe(0);
    // But the micro-unit value preserves it
    expect(m.microUnits).toBe(500_000n);
  });

  it('fromString parses whole dollars', () => {
    const m = DecimalMoney.fromString('42');
    expect(m.toCents()).toBe(4200);
  });

  it('fromString parses negative values', () => {
    const m = DecimalMoney.fromString('-3.50');
    expect(m.toCents()).toBe(-350);
  });

  it('fromString throws on empty string', () => {
    expect(() => DecimalMoney.fromString('')).toThrow();
  });

  it('zero() is zero', () => {
    const z = DecimalMoney.zero();
    expect(z.isZero()).toBe(true);
    expect(z.toCents()).toBe(0);
  });
});

// =============================================================================
// Basic arithmetic
// =============================================================================

describe('DecimalMoney — arithmetic', () => {
  it('add sums two values', () => {
    const a = DecimalMoney.fromCents(100);
    const b = DecimalMoney.fromCents(250);
    expect(a.add(b).toCents()).toBe(350);
  });

  it('subtract yields the difference', () => {
    const a = DecimalMoney.fromCents(500);
    const b = DecimalMoney.fromCents(175);
    expect(a.subtract(b).toCents()).toBe(325);
  });

  it('subtract can produce negative values', () => {
    const a = DecimalMoney.fromCents(50);
    const b = DecimalMoney.fromCents(100);
    const result = a.subtract(b);
    expect(result.toCents()).toBe(-50);
    expect(result.isNegative()).toBe(true);
  });

  it('negate flips sign', () => {
    const m = DecimalMoney.fromCents(42);
    expect(m.negate().toCents()).toBe(-42);
    expect(m.negate().negate().toCents()).toBe(42);
  });

  it('abs returns absolute value', () => {
    const neg = DecimalMoney.fromCents(-99);
    expect(neg.abs().toCents()).toBe(99);
    const pos = DecimalMoney.fromCents(99);
    expect(pos.abs().toCents()).toBe(99);
  });
});

// =============================================================================
// Percentage multiplication & split precision
// =============================================================================

describe('DecimalMoney — multiply (percentage splits)', () => {
  it('50 % of $10.00 = $5.00', () => {
    const ten = DecimalMoney.fromFloat(10.0);
    const half = ten.multiply(0.5);
    expect(half.toCents()).toBe(500);
  });

  it('33.33 % split – three ways sums to original or within 1 micro-unit', () => {
    const total = DecimalMoney.fromCents(10000); // $100.00
    const third = total.multiply(1 / 3);
    const sum = third.add(third).add(third);
    // The sum of three truncated thirds may differ by at most a few micro-units
    const diff = total.subtract(sum).microUnits;
    // Difference should be less than 3 micro-units (rounding artefact)
    expect(diff >= 0n).toBe(true);
    expect(diff < 3n).toBe(true);
  });

  it('no epsilon drift: 10 % of $0.01 preserves micro-unit precision', () => {
    const oneCent = DecimalMoney.fromCents(1);
    const tenPct = oneCent.multiply(0.10);
    // 10 % of 1 cent = 0.1 cents = 100_000 micro-units
    expect(tenPct.microUnits).toBe(100_000n);
  });

  it('multiply by 0 yields zero', () => {
    const m = DecimalMoney.fromFloat(99.99);
    expect(m.multiply(0).isZero()).toBe(true);
  });

  it('multiply by 1 yields same value', () => {
    const m = DecimalMoney.fromCents(12345);
    expect(m.multiply(1).equals(m)).toBe(true);
  });

  it('percentage split across 4 parties with remainder', () => {
    const pool = DecimalMoney.fromFloat(100.0); // $100.00
    const shares = [0.25, 0.25, 0.25, 0.25];
    const parts = shares.map((s) => pool.multiply(s));
    const sum = parts.reduce((acc, p) => acc.add(p), DecimalMoney.zero());
    expect(sum.equals(pool)).toBe(true);
  });

  it('uneven 3-way split: 50/30/20', () => {
    const pool = DecimalMoney.fromCents(9999); // $99.99
    const a = pool.multiply(0.50);
    const b = pool.multiply(0.30);
    const c = pool.multiply(0.20);
    const sum = a.add(b).add(c);
    // Tolerance: at most a few micro-units of rounding
    const diff = pool.subtract(sum).microUnits;
    expect(diff >= -2n && diff <= 2n).toBe(true);
  });
});

// =============================================================================
// Accumulation stress test
// =============================================================================

describe('DecimalMoney — accumulation', () => {
  it('accumulating 10 000 micro-transactions of $0.01 equals $100.00', () => {
    const oneCent = DecimalMoney.fromCents(1);
    let acc = DecimalMoney.zero();
    for (let i = 0; i < 10_000; i++) {
      acc = acc.add(oneCent);
    }
    expect(acc.toCents()).toBe(10_000);
    expect(acc.toFloat()).toBeCloseTo(100.0, 10);
  });

  it('accumulating 10 000 fractional adds stays exact', () => {
    // $0.001 each (sub-cent)
    const tiny = DecimalMoney.fromFloat(0.001);
    let acc = DecimalMoney.zero();
    for (let i = 0; i < 10_000; i++) {
      acc = acc.add(tiny);
    }
    // Should be exactly $10.00 = 1000 cents
    expect(acc.toCents()).toBe(1000);
    expect(acc.microUnits).toBe(1_000_000_000n);
  });
});

// =============================================================================
// Comparison
// =============================================================================

describe('DecimalMoney — comparison', () => {
  it('compare returns -1, 0, 1 correctly', () => {
    const a = DecimalMoney.fromCents(100);
    const b = DecimalMoney.fromCents(200);
    expect(a.compare(b)).toBe(-1);
    expect(b.compare(a)).toBe(1);
    expect(a.compare(a)).toBe(0);
  });

  it('equals checks structural equality', () => {
    const a = DecimalMoney.fromCents(42);
    const b = DecimalMoney.fromCents(42);
    expect(a.equals(b)).toBe(true);
  });

  it('greaterThan / lessThan / gte / lte', () => {
    const a = DecimalMoney.fromCents(10);
    const b = DecimalMoney.fromCents(20);
    expect(a.lessThan(b)).toBe(true);
    expect(b.greaterThan(a)).toBe(true);
    expect(a.greaterThanOrEqual(a)).toBe(true);
    expect(a.lessThanOrEqual(a)).toBe(true);
  });
});

// =============================================================================
// Formatting
// =============================================================================

describe('DecimalMoney — formatting', () => {
  it('toString formats as dollars with 2 decimal places', () => {
    expect(DecimalMoney.fromCents(150).toString()).toBe('1.50');
    expect(DecimalMoney.fromCents(0).toString()).toBe('0.00');
    expect(DecimalMoney.fromCents(5).toString()).toBe('0.05');
    expect(DecimalMoney.fromCents(1234).toString()).toBe('12.34');
  });

  it('toString formats negative values', () => {
    expect(DecimalMoney.fromCents(-150).toString()).toBe('-1.50');
  });

  it('toExactString shows 6 decimal places', () => {
    const m = DecimalMoney.fromFloat(1.5034);
    expect(m.toExactString()).toBe('1.503400');
  });

  it('toExactString for zero', () => {
    expect(DecimalMoney.zero().toExactString()).toBe('0.000000');
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe('DecimalMoney — edge cases', () => {
  it('zero is not negative and not positive', () => {
    const z = DecimalMoney.zero();
    expect(z.isZero()).toBe(true);
    expect(z.isNegative()).toBe(false);
    expect(z.isPositive()).toBe(false);
  });

  it('fromFloat with negative value', () => {
    const m = DecimalMoney.fromFloat(-3.14);
    expect(m.isNegative()).toBe(true);
    expect(m.toCents()).toBe(-314);
  });

  it('large value does not overflow', () => {
    // $1 billion = 100_000_000_000 cents
    const big = DecimalMoney.fromCents(100_000_000_000);
    expect(big.toCents()).toBe(100_000_000_000);
    expect(big.toString()).toBe('1000000000.00');
  });

  it('rounding from fromFloat is deterministic', () => {
    // $0.1 + $0.2 via float would normally be 0.30000000000000004
    const a = DecimalMoney.fromFloat(0.1);
    const b = DecimalMoney.fromFloat(0.2);
    const sum = a.add(b);
    const direct = DecimalMoney.fromFloat(0.3);
    expect(sum.equals(direct)).toBe(true);
  });

  it('multiply by negative percentage', () => {
    const m = DecimalMoney.fromCents(1000);
    const result = m.multiply(-0.5);
    expect(result.toCents()).toBe(-500);
  });

  it('fromCents with negative', () => {
    const m = DecimalMoney.fromCents(-1);
    expect(m.toCents()).toBe(-1);
    expect(m.isNegative()).toBe(true);
  });

  it('toFloat round-trips through fromFloat for simple values', () => {
    const values = [0, 1.0, 0.01, 99.99, -42.50, 1000.00];
    for (const v of values) {
      const m = DecimalMoney.fromFloat(v);
      expect(m.toFloat()).toBeCloseTo(v, 6);
    }
  });
});
