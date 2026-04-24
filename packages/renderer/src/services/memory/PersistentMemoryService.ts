/**
 * PersistentMemoryService
 *
 * 5-layer memory architecture for agents:
 * 1. Scratchpad (session-local, ~5KB) - Current task state
 * 2. Session (IndexedDB, 24h) - Recent decisions & tool outputs
 * 3. CORE Vault (Firestore, persistent) - Long-term learned patterns
 * 4. Captain's Logs (Firestore, append-only) - Audit trail of all decisions
 * 5. RAG Index (semantic search) - Fast semantic lookup over all memories
 *
 * Enables agents to learn from past interactions and maintain context
 * across sessions, improving decision quality over time.
 */

import { logger } from '@/utils/logger';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  query as firestoreQuery, 
  where, 
  orderBy, 
  limit as firestoreLimit 
} from 'firebase/firestore';
import { db } from '@/services/firebase';

// ============================================================================
// Memory Types
// ============================================================================

export type MemoryLayer =
  | 'scratchpad'
  | 'session'
  | 'core-vault'
  | 'captain-logs'
  | 'rag-index';

export interface Memory {
  id: string;
  layer: MemoryLayer;
  key: string;
  value: Record<string, unknown>;
  timestamp: number;
  ttl?: number; // Time-to-live in seconds (for session layer)
  tags: string[];
  embedding?: number[]; // Vector embedding for semantic search
}

export interface ContextWindow {
  scratchpad: Record<string, unknown>;
  recentDecisions: Memory[];
  learnedPatterns: Memory[];
  relevantHistory: Memory[];
}

interface SessionMemoryDB extends DBSchema {
  memories: {
    key: string;
    value: Memory;
    indexes: {
      'by-timestamp': number;
      'by-layer': string;
      'by-tags': string[];
    };
  };
}

// ============================================================================
// PersistentMemoryService
// ============================================================================

export class PersistentMemoryService {
  private db: IDBPDatabase<SessionMemoryDB> | null = null;
  private scratchpad: Map<string, Record<string, unknown>> = new Map();
  private userId: string = '';
  private db24hWindow = 24 * 60 * 60 * 1000; // 24 hours in ms

  async initialize(userId: string): Promise<void> {
    this.userId = userId;

    try {
      // Initialize IndexedDB for session layer
      this.db = await openDB<SessionMemoryDB>('indiiOS_agent_memory', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('memories')) {
            const store = db.createObjectStore('memories', { keyPath: 'id' });
            store.createIndex('by-timestamp', 'timestamp');
            store.createIndex('by-layer', 'layer');
            store.createIndex('by-tags', 'tags', { multiEntry: true });
          }
        }
      });

      logger.info(`[PersistentMemory] Initialized for user ${userId}`);
    } catch (error) {
      logger.error('[PersistentMemory] Failed to initialize IndexedDB', error);
    }
  }

  /**
   * Write to memory layer
   */
  async write(
    layer: MemoryLayer,
    key: string,
    value: Record<string, unknown>,
    tags: string[] = [],
    ttl?: number
  ): Promise<void> {
    const id = `${layer}-${key}-${Date.now()}`;
    const memory: Memory = {
      id,
      layer,
      key,
      value,
      timestamp: Date.now(),
      tags,
      ttl
    };

    try {
      switch (layer) {
        case 'scratchpad':
          this.scratchpad.set(key, value);
          break;

        case 'session':
          if (!this.db) throw new Error('IndexedDB not initialized');
          await this.db.add('memories', memory);
          break;

        case 'core-vault':
          await this.writeToFirestore(`users/${this.userId}/core-vault/${key}`, memory as unknown as Record<string, unknown>);
          await this.writeToFirestore(`users/${this.userId}/core-vault/${key}`, (memory as unknown) as Record<string, unknown>);
          break;

        case 'captain-logs':
          await this.appendToFirestore(
            `users/${this.userId}/captain-logs`,
            memory as unknown as Record<string, unknown>
            (memory as unknown) as Record<string, unknown>
          );
          break;

        case 'rag-index':
          // TODO: Implement vector embedding and semantic indexing
          if (!this.db) throw new Error('IndexedDB not initialized');
          await this.db.add('memories', memory);
          break;
      }

      logger.debug(`[PersistentMemory] Wrote to ${layer}/${key}`);
    } catch (error) {
      logger.error(`[PersistentMemory] Failed to write to ${layer}`, error);
    }
  }

  /**
   * Read from memory layer
   */
  async read(layer: MemoryLayer, key: string): Promise<Record<string, unknown> | null> {
    try {
      switch (layer) {
        case 'scratchpad':
          return this.scratchpad.get(key) ?? null;

        case 'session': {
          if (!this.db) return null;
          const allMemories = await this.db.getAll('memories');
          const sessionMemory = allMemories.find(
            (m) =>
              m.layer === 'session' &&
              m.key === key &&
              Date.now() - m.timestamp < this.db24hWindow
          );
          return sessionMemory?.value ?? null;
        }

        case 'core-vault':
          return await this.readFromFirestore(
            `users/${this.userId}/core-vault/${key}`
          );

        case 'captain-logs': {
          const logsSnapshot = await admin
            .firestore()
            .collection(`users/${this.userId}/captain-logs`)
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();

          if (logsSnapshot.empty) return null;
          const doc = logsSnapshot.docs[0];
          return doc ? (doc.data() as Record<string, unknown>) : null;
          const q = firestoreQuery(
            collection(db, `users/${this.userId}/captain-logs`),
            orderBy('timestamp', 'desc'),
            firestoreLimit(1)
          );
          const logsSnapshot = await getDocs(q);

          if (logsSnapshot.empty || !logsSnapshot.docs[0]) return null;
          return logsSnapshot.docs[0].data() as Record<string, unknown>;
        }

        case 'rag-index': {
          if (!this.db) return null;
          const ragMemory = await this.db.get('memories', key);
          return ragMemory?.value ?? null;
        }

        default:
          return null;
      }
    } catch (error) {
      logger.error(`[PersistentMemory] Failed to read from ${layer}`, error);
      return null;
    }
  }

  /**
   * Search memories across layers
   */
  async search(
    query: string,
    layers: MemoryLayer[] = ['session', 'core-vault'],
    limit = 10
  ): Promise<Memory[]> {
    const results: Memory[] = [];

    try {
      for (const layer of layers) {
        if (layer === 'session' && this.db) {
          const allMemories = await this.db.getAll('memories');
          const matches = allMemories
            .filter(
              (m) =>
                m.layer === 'session' &&
                (m.key.includes(query) ||
                  m.tags.some((tag) => tag.includes(query))) &&
                Date.now() - m.timestamp < this.db24hWindow
            )
            .slice(0, limit);

          results.push(...matches);
        } else if (layer === 'core-vault') {
          // Query Firestore for matching patterns
          const q = firestoreQuery(
            collection(db, `users/${this.userId}/core-vault`),
            where('key', '>=', query),
            where('key', '<=', query + ''),
            firestoreLimit(limit)
          );
          const snapshot = await getDocs(q);

          snapshot.docs.forEach((doc) => {
            results.push(doc.data() as Memory);
          });
        }
      }

      return results.slice(0, limit);
    } catch (error) {
      logger.error('[PersistentMemory] Search failed', error);
      return [];
    }
  }

  /**
   * Get context window for agent
   */
  async getContext(task: string): Promise<ContextWindow> {
    try {
      const scratchpad: Record<string, unknown> = {};
      this.scratchpad.forEach((value, key) => {
        scratchpad[key] = value;
      });

      const recentDecisions = await this.search(task, ['session'], 5);

      const learnedPatterns = await this.read('core-vault', `patterns-${task}`);
      const patterns = learnedPatterns
        ? [{ id: `patterns-${task}`, layer: 'core-vault' as MemoryLayer, ...learnedPatterns } as Memory]
        : [];

      const relevantHistory = await this.search(task, ['captain-logs'], 3);

      return {
        scratchpad,
        recentDecisions,
        learnedPatterns: patterns,
        relevantHistory
      };
    } catch (error) {
      logger.error('[PersistentMemory] Failed to get context', error);
      return {
        scratchpad: {},
        recentDecisions: [],
        learnedPatterns: [],
        relevantHistory: []
      };
    }
  }

  /**
   * Cleanup expired session memories
   */
  async cleanup(): Promise<void> {
    try {
      if (!this.db) return;

      const allMemories = await this.db.getAll('memories');
      const now = Date.now();

      for (const memory of allMemories) {
        if (
          memory.layer === 'session' &&
          memory.ttl &&
          now - memory.timestamp > memory.ttl * 1000
        ) {
          await this.db.delete('memories', memory.id);
        }
      }

      logger.debug('[PersistentMemory] Cleanup complete');
    } catch (error) {
      logger.error('[PersistentMemory] Cleanup failed', error);
    }
  }

  // ========================================================================
  // Firestore Helpers
  // ========================================================================

  private async writeToFirestore(
    path: string,
    data: Record<string, unknown>
  ): Promise<void> {
    await setDoc(doc(db, path), data, { merge: true });
  }

  private async readFromFirestore(path: string): Promise<Record<string, unknown> | null> {
    const docSnap = await getDoc(doc(db, path));
    return docSnap.exists() ? (docSnap.data() as Record<string, unknown>) : null;
  }

  private async appendToFirestore(
    collectionPath: string,
    data: Record<string, unknown>
  ): Promise<void> {
    await addDoc(collection(db, collectionPath), data);
  }
}

// ============================================================================
// Singleton
// ============================================================================

let persistentMemoryService: PersistentMemoryService | null = null;

export async function initializePersistentMemoryService(
  userId: string
): Promise<PersistentMemoryService> {
  if (!persistentMemoryService) {
    persistentMemoryService = new PersistentMemoryService();
    await persistentMemoryService.initialize(userId);
  }
  return persistentMemoryService;
}

export function getPersistentMemoryService(): PersistentMemoryService {
  if (!persistentMemoryService) {
    throw new Error('PersistentMemoryService not initialized');
  }
  return persistentMemoryService;
}
