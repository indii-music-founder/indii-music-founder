import { describe, expect, it } from 'vitest';
import { decodeSdkResponse, sdkRequestHeaders, normalizeSdkBaseUrl } from './response';

// Pure envelope/header rules, not simulated HTTP service or customer data.
describe('SDK transport boundaries', () => {
  it('distinguishes raw structured documents, data envelopes and declared failure', () => {
    expect(decodeSdkResponse({ success: true, data: 42 })).toBe(42);
    const document = { '@context': 'urn:contract-check', count: 0 };
    expect(decodeSdkResponse(document, true)).toBe(document);
    expect(() => decodeSdkResponse(document)).toThrow('missing data');
    expect(() => decodeSdkResponse({ success: false, data: 42 })).toThrow('unsuccessful');
    expect(() => decodeSdkResponse([])).toThrow('envelope');
  });
  it('strips case-insensitive authorization from public requests without mutating private headers', () => {
    const base = { Authorization: 'opaque', authorization: 'opaque-lower', 'Content-Type': 'application/json' };
    expect(sdkRequestHeaders(base, true)).toEqual({ 'Content-Type': 'application/json' });
    expect(sdkRequestHeaders(base, false)).toEqual(base);
    expect(base.Authorization).toBe('opaque');
  });
});

describe('SDK destination grammar', () => {
  it('retains deployment prefixes and permits explicit local development', () => {
    expect(normalizeSdkBaseUrl('https://example.com/function/')).toBe('https://example.com/function');
    expect(normalizeSdkBaseUrl('http://127.0.0.1:5001/project/region/function')).toBe('http://127.0.0.1:5001/project/region/function');
  });
  it('rejects remote plaintext, embedded credentials and ambiguous URL state', () => {
    for (const value of ['http://example.com', 'https://name:secret@example.com', 'https://example.com/?next=other', 'https://example.com/#fragment', 'file:///tmp/api', 'not a URL']) {
      expect(() => normalizeSdkBaseUrl(value)).toThrow();
    }
  });
});
