import { describe, expect, it } from 'vitest';
import { sdkRoute } from './sdkRoute';

describe('SDK HTTP grammar without authenticated or persisted state', () => {
  it('recognizes collection, resource and submission operations', () => {
    expect(sdkRoute('GET', '/tracks?limit=10')).toEqual({ operation: 'listTracks' });
    expect(sdkRoute('PATCH', '/tracks/item')).toEqual({ operation: 'updateTrack', id: 'item' });
    expect(sdkRoute('POST', '/distributions/item/submit')).toEqual({ operation: 'submitDistribution', id: 'item' });
    expect(sdkRoute('GET', '/catalog/v1')).toEqual({ operation: 'getCatalog' });
  });
  it('rejects malformed IDs, unknown routes and wrong methods', () => {
    for (const path of ['/tracks/..', '/tracks/%2e%2e', '/tracks/a%2Fb', '/tracks/%00', '/tracks/%', '/tracks/a/b']) {
      expect(sdkRoute('GET', path)).toBeUndefined();
    }
    expect(sdkRoute('POST', '/tracks/item/submit')).toBeUndefined();
    expect(sdkRoute('DELETE', '/account/profile')).toBeUndefined();
  });
});
