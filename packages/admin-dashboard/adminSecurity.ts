import { createHash, timingSafeEqual } from 'node:crypto';

/** Compare fixed-size digests; never compare a supplied secret by prefix. */
export function matchesWebhookSecret(expected: string, supplied: unknown): boolean {
  if (!expected || typeof supplied !== 'string') return false;
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(expected), digest(supplied));
}

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

export function escapeEmailHtml(text: string): string {
  return text.replace(/[&<>"']/g, character => HTML_ENTITIES[character]);
}

/** A recipient must not add headers or silently become a recipient list. */
export function isSingleLineEmailRecipient(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim() || !value.includes('@')) return false;
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127 || character === ',' || character === ';') return false;
  }
  return true;
}
