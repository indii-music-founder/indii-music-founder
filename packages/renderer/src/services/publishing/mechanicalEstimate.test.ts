import { describe, expect, it } from 'vitest';
import { estimateMechanicalFee } from './mechanicalEstimate';

// Pure statutory-estimate arithmetic, not a licensing-service or customer fixture.
describe('2026 physical/permanent-download mechanical estimate', () => {
    it('uses the per-work minimum for short songs', () => {
        expect(estimateMechanicalFee(1000, 180, 2026)).toEqual({ ratePerCopy: 0.131, totalFee: 131, billableMinutes: 3 });
    });
    it('keeps the minimum at exactly five minutes', () => {
        expect(estimateMechanicalFee(1000, 300, 2026).totalFee).toBe(131);
    });
    it('rounds a partial sixth minute up before selecting the greater rate', () => {
        expect(estimateMechanicalFee(1000, 300.001, 2026)).toEqual({ ratePerCopy: 0.1512, totalFee: 151.2, billableMinutes: 6 });
    });
    it('uses the full duration for a ten-minute work', () => {
        expect(estimateMechanicalFee(1000, 600, 2026).totalFee).toBe(252);
    });
    it('rounds the aggregate estimate once to USD cents', () => {
        expect(estimateMechanicalFee(5, 180, 2026).totalFee).toBe(0.66);
        expect(estimateMechanicalFee(1, 301, 2026).totalFee).toBe(0.15);
    });
    it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid copies %s', copies => {
        expect(() => estimateMechanicalFee(copies, 180, 2026)).toThrow(/Copies/);
    });
    it.each([0, -1, NaN, Infinity, undefined])('requires an actual duration %s', duration => {
        expect(() => estimateMechanicalFee(1000, duration as number, 2026)).toThrow(/duration/);
    });
    it.each([2025, 2027, 2028, 2032, NaN])('does not apply 2026 rates to unverified year %s', year => {
        expect(() => estimateMechanicalFee(1000, 180, year)).toThrow(/verification/);
    });
    it('rejects overflow before producing a monetary estimate', () => {
        expect(() => estimateMechanicalFee(Number.MAX_SAFE_INTEGER, 180, 2026)).toThrow(/range/);
        expect(() => estimateMechanicalFee(1000, Number.MAX_VALUE, 2026)).toThrow(/range/);
    });
});
