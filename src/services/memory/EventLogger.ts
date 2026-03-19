/**
 * JSONL Event Logger — Externalized Memory Layer
 *
 * Treats LLM context as a bounded cache; this logger provides the append-only
 * disk-of-truth. Every agent interaction is persisted as a newline-delimited
 * JSON record (JSONL) so that context can be compacted into the 4-Tier Memory
 * hierarchy without information loss.
 *
 * 4-Tier Memory (aligned with AlwaysOnMemoryEngine):
 *   working    → active conversation buffer (< 1 hour)
 *   shortTerm  → recent session summary (< 7 days)
 *   longTerm   → persistent entity graph entries (< 1 year)
 *   archived   → cold storage; queryable via embedding search
 *
 * Security: No credentials or true secrets are written to logs.
 * Identifiers (session IDs, agent IDs) are safe to persist.
 */

import { logger } from '@/utils/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MemoryTier = 'working' | 'shortTerm' | 'longTerm' | 'archived';

export interface EventRecord {
  id: string;           // UUID
  ts: number;           // Unix ms timestamp
  sessionId: string;
  agentId: string;
  namespace?: string;   // e.g. "cron:album-rollout" for background jobs
  tier: MemoryTier;
  type: 'message' | 'tool_call' | 'tool_result' | 'system' | 'compaction' | 'entity_extract';
  role: 'user' | 'model' | 'system';
  text: string;
  meta?: Record<string, unknown>; // Non-sensitive structured data
}

export interface CompactionResult {
  summary: string;
  entitiesExtracted: string[];
  recordsCompacted: number;
  newTier: MemoryTier;
}

// ─── Tier Thresholds ─────────────────────────────────────────────────────────

const TIER_THRESHOLDS: Record<MemoryTier, number> = {
  working: 60 * 60 * 1000,           // 1 hour
  shortTerm: 7 * 24 * 60 * 60 * 1000, // 7 days
  longTerm: 365 * 24 * 60 * 60 * 1000, // 1 year
  archived: Infinity,
};

const TIER_ORDER: MemoryTier[] = ['working', 'shortTerm', 'longTerm', 'archived'];

// ─── In-Memory Ring Buffer (working tier) ────────────────────────────────────

const WORKING_BUFFER_MAX = 200;

// ─── EventLogger ─────────────────────────────────────────────────────────────

class EventLoggerService {
  private buffer: EventRecord[] = []; // working-tier ring buffer
  private sessionIndex: Map<string, EventRecord[]> = new Map();
  private compactionCallbacks: Array<(result: CompactionResult) => void> = [];

  // ─── Append ──────────────────────────────────────────────────────────────

  /**
   * Append a new event record. Automatically assigns tier based on age heuristic.
   * Triggers compaction check after every append.
   */
  append(record: Omit<EventRecord, 'id' | 'ts' | 'tier'>): EventRecord {
    const full: EventRecord = {
      ...record,
      id: crypto.randomUUID(),
      ts: Date.now(),
      tier: 'working',
    };

    this.buffer.push(full);
    this._indexBySession(full);

    // Persist to localStorage (Electron picks this up for disk-write via preload)
    this._persistToLocalStorage(full);

    // Trigger compaction if working buffer is at capacity
    if (this.buffer.length > WORKING_BUFFER_MAX) {
      this._compactWorking();
    }

    return full;
  }

  // ─── Query ───────────────────────────────────────────────────────────────

  /**
   * Retrieve records for a session, optionally filtered by tier and count limit.
   */
  getSessionRecords(
    sessionId: string,
    options: { tier?: MemoryTier; limit?: number } = {}
  ): EventRecord[] {
    const records = this.sessionIndex.get(sessionId) ?? [];
    let filtered = options.tier
      ? records.filter(r => r.tier === options.tier)
      : records;

    filtered = filtered.sort((a, b) => a.ts - b.ts);

    if (options.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  /**
   * Promote aged records to the next tier. Call periodically or on compaction trigger.
   */
  promoteTiers(): void {
    const now = Date.now();

    for (const records of this.sessionIndex.values()) {
      for (const record of records) {
        const currentIdx = TIER_ORDER.indexOf(record.tier);
        if (currentIdx === TIER_ORDER.length - 1) continue; // already archived

        const nextTier = TIER_ORDER[currentIdx + 1]!;
        const ageMs = now - record.ts;

        if (ageMs > TIER_THRESHOLDS[record.tier]) {
          record.tier = nextTier;
        }
      }
    }
  }

  /**
   * Return a JSONL string for all records of a session (for disk export).
   */
  exportJSONL(sessionId: string): string {
    const records = this.getSessionRecords(sessionId);
    return records.map(r => JSON.stringify(r)).join('\n');
  }

  // ─── Compaction ──────────────────────────────────────────────────────────

  /**
   * Register a callback invoked whenever working memory is compacted to shortTerm.
   * The AlwaysOnMemoryEngine hooks in here to update the 4-tier store.
   */
  onCompaction(cb: (result: CompactionResult) => void): () => void {
    this.compactionCallbacks.push(cb);
    return () => {
      this.compactionCallbacks = this.compactionCallbacks.filter(fn => fn !== cb);
    };
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private _indexBySession(record: EventRecord): void {
    const existing = this.sessionIndex.get(record.sessionId) ?? [];
    existing.push(record);
    this.sessionIndex.set(record.sessionId, existing);
  }

  private _compactWorking(): void {
    // Move oldest half of working buffer to shortTerm tier
    const pivot = Math.floor(this.buffer.length / 2);
    const toCompact = this.buffer.splice(0, pivot);

    const compactedTexts: string[] = [];
    const sessions = new Set<string>();

    for (const record of toCompact) {
      record.tier = 'shortTerm';
      compactedTexts.push(record.text);
      sessions.add(record.sessionId);
    }

    // Simple entity extraction: extract proper nouns (words starting with capital letters)
    // In production, this delegates to the Gemini embedding pipeline
    const entitySet = new Set<string>();
    for (const text of compactedTexts) {
      const words = text.split(/\s+/);
      for (const word of words) {
        const clean = word.replace(/[^a-zA-Z0-9]/g, '');
        if (clean.length > 2 && /^[A-Z]/.test(clean)) {
          entitySet.add(clean);
        }
      }
    }

    const result: CompactionResult = {
      summary: `Compacted ${toCompact.length} records across ${sessions.size} session(s).`,
      entitiesExtracted: [...entitySet].slice(0, 50),
      recordsCompacted: toCompact.length,
      newTier: 'shortTerm',
    };

    logger.info('[EventLogger] Compaction complete:', result.summary);
    this.compactionCallbacks.forEach(cb => {
      try { cb(result); } catch (err) { logger.error('[EventLogger] Compaction callback error', err); }
    });
  }

  private _persistToLocalStorage(record: EventRecord): void {
    if (typeof window === 'undefined') return;

    try {
      const key = `indiiOS_events_${record.sessionId}`;
      // Scrub sensitive data before persisting
      const scrubbed = { ...record, text: this._scrub(record.text) };
      if (scrubbed.meta) {
        scrubbed.meta = JSON.parse(this._scrub(JSON.stringify(scrubbed.meta)));
      }
      const existing = localStorage.getItem(key) ?? '';
      const updated = existing
        ? `${existing}\n${JSON.stringify(scrubbed)}`
        : JSON.stringify(scrubbed);
      // Cap at ~500KB per session to avoid localStorage overflow
      if (updated.length < 500_000) {
        localStorage.setItem(key, updated);
      }
    } catch {
      // Storage quota exceeded — silent fail; in-memory buffer is still valid
    }
  }

  /**
   * Redact common sensitive patterns from text before persisting to localStorage.
   * Prevents credential/PII leakage through the JSONL memory layer.
   */
  private _scrub(text: string): string {
    return text
      .replace(/AIza[0-9A-Za-z_-]{35}/g, '[REDACTED_API_KEY]')
      .replace(/sk-[0-9A-Za-z]{20,}/g, '[REDACTED_OPENAI_KEY]')
      .replace(/ghp_[0-9A-Za-z]{36}/g, '[REDACTED_GITHUB_TOKEN]')
      .replace(/ya29\.[0-9A-Za-z_-]+/g, '[REDACTED_OAUTH_TOKEN]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]');
  }
}

export const eventLogger = new EventLoggerService();
