/** Decode transport structure only; resource methods still validate their own schemas. */
export function decodeSdkResponse(value: unknown, allowJsonLd = false): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid API response envelope.');
  const body = value as Record<string, unknown>;
  if (body.success === false) throw new Error('API reported an unsuccessful operation.');
  if (allowJsonLd && Object.prototype.hasOwnProperty.call(body, '@context')) return body;
  if (!Object.prototype.hasOwnProperty.call(body, 'data')) throw new Error('API response is missing data.');
  return body.data;
}

export function sdkRequestHeaders(base: Record<string, string>, publicRead: boolean): Record<string, string> {
  return Object.fromEntries(Object.entries(base).filter(([name]) => !publicRead || name.toLowerCase() !== 'authorization'));
}

/** Keep the configured endpoint path, but never accept credential-bearing or insecure remote URLs. */
export function normalizeSdkBaseUrl(value: string): string {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && local))) {
    throw new Error('SDK API URL must use HTTPS, or HTTP loopback for local development, without credentials, query or fragment.');
  }
  return url.href.replace(/\/+$/, '');
}
