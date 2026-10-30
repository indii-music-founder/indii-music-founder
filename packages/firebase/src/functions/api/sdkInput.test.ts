import { describe, expect, it } from 'vitest';
import { SdkCreateTrack, SdkUpdateTrack, SdkUpdateProfile, sdkPagination } from './sdkInput';

// Pure request grammar, no authenticated identity or persisted customer state.
describe('SDK mutation and pagination input boundaries', () => {
  it('rejects uneditable fields and invalid numeric values', () => {
    for (const field of ['artistId', 'ownerId', 'userId', 'createdAt', 'status']) {
      expect(SdkUpdateTrack.safeParse({ title: 'Input contract', [field]: 'untrusted' }).success).toBe(false);
    }
    expect(SdkUpdateTrack.safeParse({}).success).toBe(false);
    expect(SdkCreateTrack.safeParse({ title: 'Input contract', duration: -1 }).success).toBe(false);
    expect(SdkCreateTrack.safeParse({ title: 'Input contract', duration: Infinity }).success).toBe(false);
    expect(SdkUpdateProfile.safeParse({ name: ' ', admin: true }).success).toBe(false);
  });
  it('bounds pagination without silently treating malformed queries as defaults', () => {
    expect(sdkPagination({})).toEqual({ limit: 20, offset: 0 });
    expect(sdkPagination({ limit: '10', offset: '50' })).toEqual({ limit: 10, offset: 50 });
    for (const value of ['', '-1', '1.2', '1e3', ['10'], '101']) {
      expect(() => sdkPagination({ limit: value })).toThrow();
    }
  });
});
