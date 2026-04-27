import { db } from '@/services/firebase';
import {
  collection,
  doc,
  getDoc,
  setDoc,
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

  /** Create or get the default "Inbox" project for a user */
  static async ensureInbox(userId: string): Promise<Project> {
    const existing = await ProjectService.listByUser(userId);
    const inbox = existing.find((p) => p.name === 'Inbox');
    if (inbox) return inbox;

    return ProjectService.create(userId, 'Inbox', 'Default workspace');
  }
}
