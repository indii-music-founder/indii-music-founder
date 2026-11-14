import { describe, expect, it } from 'vitest';
import { isCompleteSplit } from './escrowSplitMath';

describe('escrow split completeness', () => {
    it('accepts only positive shares totaling 100 percent', () => {
        expect(isCompleteSplit([40, 60])).toBe(true);
        expect(isCompleteSplit([33.33, 33.33, 33.34])).toBe(true);
        for (const shares of [[], [50], [0, 100], [-10, 110], [101], [NaN, 100]]) {
            expect(isCompleteSplit(shares)).toBe(false);
        }
    });
});
