import { db } from '@/services/firebase';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  serverTimestamp,
  addDoc,
  Timestamp,
} from 'firebase/firestore';

export type ProjectStatus = 'active' | 'paused' | 'archived';

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  archivedAt?: Timestamp;
}

export interface ProjectRef {
  projectId: string;
  projectName: string;
}

export class ProjectService {
  static async create(
    userId: string,
    name: string,
    description: string = '',
  ): Promise<Project> {
    const now = serverTimestamp();
    const projectData: Omit<Project, 'id'> = {
      userId,
      name,
      description,
      status: 'active',
      createdAt: now as Timestamp,
      updatedAt: now as Timestamp,
    };

    const docRef = await addDoc(collection(db, 'projects'), projectData);

    return {
      id: docRef.id,
      ...projectData,
    };
  }

  static async get(projectId: string): Promise<Project | null> {
    const docRef = doc(db, 'projects', projectId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists()
      ? ({ id: snapshot.id, ...snapshot.data() } as Project)
      : null;
  }

  static async update(
    projectId: string,
    updates: Partial<Omit<Project, 'id' | 'userId' | 'createdAt'>>,
  ): Promise<void> {
    const docRef = doc(db, 'projects', projectId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  }

  static async setStatus(
    projectId: string,
    status: ProjectStatus,
  ): Promise<void> {
    const docRef = doc(db, 'projects', projectId);
    await updateDoc(docRef, {
      status,
      ...(status === 'archived' && { archivedAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    });
  }

  static async listByUser(userId: string): Promise<Project[]> {
    const q = query(
      collection(db, 'projects'),
      where('userId', '==', userId),
      where('status', 'in', ['active', 'paused']),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Project));
  }

  static async listArchived(userId: string): Promise<Project[]> {
    const q = query(
      collection(db, 'projects'),
      where('userId', '==', userId),
      where('status', '==', 'archived'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Project));
  }

  static async delete(projectId: string): Promise<void> {
    const docRef = doc(db, 'projects', projectId);
    await deleteDoc(docRef);
  }

  private static inboxCreationPromise: Promise<Project> | null = null;

  /** Create or get the default "Inbox" project for a user */
  static async ensureInbox(userId: string): Promise<Project> {
    if (this.inboxCreationPromise) {
      return this.inboxCreationPromise;
    }

    const promise = (async () => {
      try {
        const existing = await ProjectService.listByUser(userId);
        let inbox = existing.find((p) => p.name === 'Inbox');
        
        // Cleanup duplicates if they exist (keep the oldest one)
        const allInboxes = existing.filter(p => p.name === 'Inbox').sort((a, b) => {
            const timeA = a.createdAt?.toMillis() || 0;
            const timeB = b.createdAt?.toMillis() || 0;
            return timeA - timeB;
        });
        
        if (allInboxes.length > 1) {
            inbox = allInboxes[0];
            for (let i = 1; i < allInboxes.length; i++) {
                const dupId = allInboxes[i]?.id;
                if (dupId) await ProjectService.delete(dupId);
            }
        }
        
        if (inbox) return inbox;

        return await ProjectService.create(userId, 'Inbox', 'Default workspace');
      } finally {
        this.inboxCreationPromise = null;
      }
    })();

    this.inboxCreationPromise = promise;
    return promise;
  }
}
