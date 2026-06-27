import { FirestoreService } from '@/services/FirestoreService';
import { auth } from '@/services/firebase';
import { cleanFirestoreData } from '@/services/utils/firebase';
import { collection, onSnapshot, query, where, orderBy, limit, Timestamp, type Unsubscribe } from 'firebase/firestore';
import type { CreativeEditManifest } from '@/modules/creative/services/creativeManifest';
import { db } from '@/services/firebase';

export interface CreativeSessionRecord extends CreativeEditManifest {
  id: string;
  userId: string;
  orgId: string;
  status: 'active' | 'completed';
  selectedCandidateUri?: string | null;
  outputUri?: string | null;
  lastAction?: string;
  createdAt: number;
  updatedAt: number;
}

class CreativeSessionServiceImpl extends FirestoreService<CreativeSessionRecord> {
  constructor() {
    super('creative_sessions');
  }

  private assertAuthenticated(): string {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      throw new Error('Creative session persistence requires an authenticated user.');
    }
    return userId;
  }

  async saveSession(record: CreativeSessionRecord): Promise<void> {
    await this.set(record.id, cleanFirestoreData(record));
  }

  async updateSession(id: string, updates: Partial<CreativeSessionRecord>): Promise<void> {
    await this.update(id, cleanFirestoreData(updates));
  }

  async upsertFromManifest(manifest: CreativeEditManifest, extras: Partial<CreativeSessionRecord> = {}): Promise<CreativeSessionRecord> {
    const userId = this.assertAuthenticated();
    const orgId = 'personal';
    const existing = await this.get(manifest.sessionId);
    const now = Date.now();
    const record: CreativeSessionRecord = {
      ...manifest,
      ...extras,
      id: manifest.sessionId,
      userId,
      orgId,
      status: extras.status || existing?.status || 'active',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      selectedCandidateUri: extras.selectedCandidateUri ?? existing?.selectedCandidateUri ?? null,
      outputUri: extras.outputUri ?? existing?.outputUri ?? null,
      lastAction: extras.lastAction ?? existing?.lastAction,
    };

    await this.set(record.id, cleanFirestoreData({
      ...record,
      createdAt: Timestamp.fromMillis(record.createdAt),
      updatedAt: Timestamp.fromMillis(record.updatedAt),
    }) as unknown as CreativeSessionRecord);

    return record;
  }

  async loadSession(sessionId: string): Promise<CreativeSessionRecord | null> {
    return this.get(sessionId);
  }

  subscribeToRecentSessions(onUpdate: (sessions: CreativeSessionRecord[]) => void, onError: (error: Error) => void): Unsubscribe {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      onUpdate([]);
      return () => undefined;
    }

    const q = query(
      collection(db, 'creative_sessions'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc'),
      limit(25),
    );

    return onSnapshot(q, snapshot => {
      const sessions = snapshot.docs.map((snap) => {
        const data = snap.data() as CreativeSessionRecord;
        const createdAt = typeof data.createdAt === 'number'
          ? data.createdAt
          : ((data.createdAt as { toMillis?: () => number } | null | undefined)?.toMillis?.() ?? Date.now());
        const updatedAt = typeof data.updatedAt === 'number'
          ? data.updatedAt
          : ((data.updatedAt as { toMillis?: () => number } | null | undefined)?.toMillis?.() ?? Date.now());
        return {
          ...data,
          id: snap.id,
          createdAt,
          updatedAt,
        } as CreativeSessionRecord;
      });
      onUpdate(sessions);
    }, onError);
  }
}

export const creativeSessionService = new CreativeSessionServiceImpl();

export function getCreativeSessionId(itemId: string | null, projectId: string | null): string {
  return `creative_${projectId || 'project'}_${itemId || 'session'}`;
}

export function summarizeCreativeRoute(record: CreativeSessionRecord | CreativeEditManifest): string {
  return `${record.route.label} · ${record.settings.modelTier === 'pro' ? 'Pro' : 'Flash'} · ${record.settings.imageSize ?? record.settings.resolution}`;
}

export function buildSessionFromManifest(manifest: CreativeEditManifest, extras: Partial<CreativeSessionRecord> = {}): CreativeSessionRecord {
  const userId = auth.currentUser?.uid || extras.userId || 'unknown';
  const orgId = extras.orgId || 'personal';
  const now = Date.now();
  return {
    ...manifest,
    ...extras,
    id: manifest.sessionId,
    userId,
    orgId,
    status: extras.status || 'active',
    createdAt: extras.createdAt || now,
    updatedAt: extras.updatedAt || now,
    selectedCandidateUri: extras.selectedCandidateUri ?? null,
    outputUri: extras.outputUri ?? null,
    lastAction: extras.lastAction,
  };
}
