import { describe, expect, it } from 'vitest';
import { businessMileageRate } from './mileageRate';

describe('businessMileageRate', () => {
    it('uses the two published 2026 IRS periods and fails closed in a future year', () => {
        expect(businessMileageRate(new Date(2026, 5, 30))).toBe(0.725);
        expect(businessMileageRate(new Date(2026, 6, 1))).toBe(0.76);
        expect(businessMileageRate(new Date(2027, 0, 1))).toBeNull();
    });
});
