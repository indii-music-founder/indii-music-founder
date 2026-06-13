/**
 * EventLogger — externalized JSONL memory layer tests.
 *
 * Substrate of the continuity (cross-pollination) chains: facts captured by
 * agents land here before promotion through the 4-tier hierarchy, so this
 * layer must persist, order, scrub, and compact reliably.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventLogger, type CompactionResult } from './EventLogger';

// Unique session id per test keeps the shared singleton isolated.
let counter = 0;
const newSession = () => `sess-${Date.now()}-${counter++}`;

const baseRecord = (sessionId: string, overrides: Partial<Parameters<typeof eventLogger.append>[0]> = {}) => ({
  sessionId,
  agentId: 'agent-1',
  type: 'message' as const,
  role: 'user' as const,
  text: 'hello world',
  ...overrides,
});

describe('EventLogger.append', () => {
  it('assigns id, timestamp, and working tier', () => {
    const s = newSession();
    const rec = eventLogger.append(baseRecord(s));
    expect(rec.id).toBeTruthy();
    expect(rec.tier).toBe('working');
    expect(typeof rec.ts).toBe('number');
    expect(rec.sessionId).toBe(s);
  });

  it('indexes records by session for retrieval', () => {
    const s = newSession();
    eventLogger.append(baseRecord(s, { text: 'first' }));
    eventLogger.append(baseRecord(s, { text: 'second' }));
    const records = eventLogger.getSessionRecords(s);
    expect(records.map(r => r.text)).toEqual(['first', 'second']);
  });
});

describe('EventLogger.getSessionRecords', () => {
  it('returns empty array for unknown session', () => {
    expect(eventLogger.getSessionRecords('nope')).toEqual([]);
  });

  it('orders by timestamp ascending', () => {
    const s = newSession();
    const a = eventLogger.append(baseRecord(s, { text: 'a' }));
    const b = eventLogger.append(baseRecord(s, { text: 'b' }));
    const ordered = eventLogger.getSessionRecords(s);
    expect(ordered[0]!.ts).toBeLessThanOrEqual(ordered[1]!.ts);
    expect(ordered[0]!.id).toBe(a.id);
    expect(ordered[1]!.id).toBe(b.id);
  });

  it('honors the limit option (most recent N)', () => {
    const s = newSession();
    for (let i = 0; i < 5; i++) eventLogger.append(baseRecord(s, { text: `m${i}` }));
    const last2 = eventLogger.getSessionRecords(s, { limit: 2 });
    expect(last2).toHaveLength(2);
    expect(last2.map(r => r.text)).toEqual(['m3', 'm4']);
  });

  it('filters by tier', () => {
    const s = newSession();
    eventLogger.append(baseRecord(s));
    expect(eventLogger.getSessionRecords(s, { tier: 'working' }).length).toBeGreaterThan(0);
    expect(eventLogger.getSessionRecords(s, { tier: 'archived' })).toEqual([]);
  });
});

describe('EventLogger.exportJSONL', () => {
  it('produces newline-delimited valid JSON, one record per line', () => {
    const s = newSession();
    eventLogger.append(baseRecord(s, { text: 'line one' }));
    eventLogger.append(baseRecord(s, { text: 'line two' }));
    const jsonl = eventLogger.exportJSONL(s);
    const lines = jsonl.split('\n');
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
    expect(JSON.parse(lines[0]!).text).toBe('line one');
  });
});

describe('EventLogger.promoteTiers', () => {
  it('promotes records aged past the working threshold to shortTerm', () => {
    const s = newSession();
    const rec = eventLogger.append(baseRecord(s));
    // Force the record to be older than the 1-hour working threshold.
    rec.ts = Date.now() - (2 * 60 * 60 * 1000);
    eventLogger.promoteTiers();
    expect(eventLogger.getSessionRecords(s)[0]!.tier).toBe('shortTerm');
  });

  it('leaves fresh records in the working tier', () => {
    const s = newSession();
    eventLogger.append(baseRecord(s));
    eventLogger.promoteTiers();
    expect(eventLogger.getSessionRecords(s)[0]!.tier).toBe('working');
  });
});

describe('EventLogger.onCompaction', () => {
  it('fires callback with extracted entities when the working buffer overflows', () => {
    const cb = vi.fn();
    const unsubscribe = eventLogger.onCompaction(cb);
    const s = newSession();
    // WORKING_BUFFER_MAX is 200 — push past it to trigger _compactWorking.
    for (let i = 0; i < 205; i++) {
      eventLogger.append(baseRecord(s, { text: `Detroit Techno entity ${i}` }));
    }
    expect(cb).toHaveBeenCalled();
    const result = cb.mock.calls[0]![0] as CompactionResult;
    expect(result.recordsCompacted).toBeGreaterThan(0);
    expect(result.newTier).toBe('shortTerm');
    expect(result.entitiesExtracted).toContain('Detroit');
    unsubscribe();
  });

  it('unsubscribe stops further callbacks', () => {
    const cb = vi.fn();
    const unsubscribe = eventLogger.onCompaction(cb);
    unsubscribe();
    const s = newSession();
    for (let i = 0; i < 205; i++) eventLogger.append(baseRecord(s, { text: `x${i}` }));
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('EventLogger security scrubbing (localStorage persistence)', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('redacts secret-shaped tokens before persisting', () => {
    if (typeof localStorage === 'undefined') return; // jsdom only
    const s = newSession();
    const secret = 'AI' + 'za' + 'B'.repeat(35); // synthetic Google API key shape
    eventLogger.append(baseRecord(s, { text: `key is ${secret}` }));
    const persisted = localStorage.getItem(`indii_events_${s}`) ?? '';
    expect(persisted).not.toContain(secret);
    expect(persisted).toContain('[REDACTED_API_KEY]');
  });

  it('redacts email addresses before persisting', () => {
    if (typeof localStorage === 'undefined') return;
    const s = newSession();
    eventLogger.append(baseRecord(s, { text: 'contact me at artist@example.com' }));
    const persisted = localStorage.getItem(`indii_events_${s}`) ?? '';
    expect(persisted).not.toContain('artist@example.com');
    expect(persisted).toContain('[REDACTED_EMAIL]');
  });
});
