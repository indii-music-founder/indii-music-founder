import { describe, expect, it } from 'vitest';
import { adminAdmissionAllowed, parseAdminBearer } from './adminSecurity';

// Boolean policy contract only; no fabricated account, token, session or provider.
describe('admin admission conjunction', () => {
  it('requires both exact predicates', () => {
    expect(adminAdmissionAllowed(true, true)).toBe(true);
    for (const value of [false, undefined, null, 0, 1, 'true', {}, []]) {
      expect(adminAdmissionAllowed(true, value)).toBe(false);
    }
    expect(adminAdmissionAllowed(false, true)).toBe(false);
  });
});

describe('bearer header grammar', () => {
  it('accepts one opaque credential and rejects other schemes and fragments', () => {
    expect(parseAdminBearer('Bearer opaque')).toBe('opaque');
    expect(parseAdminBearer('bearer opaque')).toBe('opaque');
    for (const header of [undefined, [], 'Basic opaque', 'Bearer ', 'Bearer first second', 'prefix Bearer opaque', 'Bearer opaque\nextra']) {
      expect(parseAdminBearer(header)).toBeUndefined();
    }
  });
});
