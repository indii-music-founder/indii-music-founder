import { expect, it } from 'vitest';
import { toMillisSafe } from './timestamps';

it('reads legacy serialized Firestore timestamps and rejects invalid dates', () => {
    expect(toMillisSafe({ seconds: 1700000000, nanoseconds: 250000000 })).toBe(1700000000250);
    expect(toMillisSafe({ seconds: 0, nanoseconds: 0 }, -1)).toBe(0);
    expect(toMillisSafe({ seconds: 0, nanoseconds: 1e9 }, -1)).toBe(-1);
    expect(toMillisSafe({ toMillis: () => Infinity }, -1)).toBe(-1);
});
