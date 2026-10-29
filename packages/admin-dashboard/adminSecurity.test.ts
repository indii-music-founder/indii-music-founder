import { describe, expect, it } from 'vitest';
import { escapeEmailHtml, isSingleLineEmailRecipient, matchesWebhookSecret } from './adminSecurity';

// Pure string/byte contracts. No authenticated accounts or provider responses.
describe('webhook secret comparison', () => {
  it('accepts exact values and rejects changed prefixes, suffixes and case', () => {
    const reference = 'opaque-reference-value';
    expect(matchesWebhookSecret(reference, reference)).toBe(true);
    for (const value of ['', reference.slice(0, -1), `${reference}x`, `x${reference}`, reference.toUpperCase()]) {
      expect(matchesWebhookSecret(reference, value)).toBe(false);
    }
  });

  it('fails closed on missing configuration and non-string inputs', () => {
    expect(matchesWebhookSecret('', '')).toBe(false);
    for (const value of [undefined, null, ['opaque-reference-value'], 1, {}]) {
      expect(matchesWebhookSecret('opaque-reference-value', value)).toBe(false);
    }
  });

  it('compares UTF-8 bytes without normalizing opaque input', () => {
    expect(matchesWebhookSecret('caf\u00e9', 'caf\u00e9')).toBe(true);
    expect(matchesWebhookSecret('caf\u00e9', 'cafe\u0301')).toBe(false);
  });
});

describe('direct-email string boundaries', () => {
  it('renders subject markup and attribute delimiters as literal text', () => {
    expect(escapeEmailHtml('<img src="x" onerror=\'run()\'> & text'))
      .toBe('&lt;img src=&quot;x&quot; onerror=&#39;run()&#39;&gt; &amp; text');
    expect(escapeEmailHtml('Plain subject')).toBe('Plain subject');
  });

  it('preserves body newlines until the caller adds its controlled break markup', () => {
    expect(escapeEmailHtml('one\n<script>two</script>')).toBe('one\n&lt;script&gt;two&lt;/script&gt;');
  });

  it('rejects header injection, control bytes and recipient lists before dispatch', () => {
    for (const value of [
      'one@example.com\r\nBcc: two@example.com', 'one@example.com\nX-Test: x',
      'one@example.com\0', 'one@example.com\t', 'one@example.com\u007f',
      'one@example.com,two@example.com', 'one@example.com;two@example.com',
      '', 'no-address', undefined, ['one@example.com'],
    ]) expect(isSingleLineEmailRecipient(value)).toBe(false);
    expect(isSingleLineEmailRecipient('one+tag@example.com')).toBe(true);
    expect(isSingleLineEmailRecipient(' one@example.com ')).toBe(true);
  });
});
