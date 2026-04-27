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
  serverTimestamp,
  addDoc,
  Timestamp,
} from 'firebase/firestore';

export type PlanShape = 'atomic' | 'workflow' | 'timeline';
export type PlanStatus = 'drafting' | 'awaiting_approval' | 'executing' | 'completed' | 'failed' | 'cancelled';

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  toolName?: string;
  input?: Record<string, unknown>;
  status: 'pending' | 'executing' | 'complete' | 'error';
  error?: string;
}

export interface Phase {
  id: string;
  title: string;
  days: number;
  milestones: string[];
}

export interface PlanDraft {
  shape: PlanShape;
  summary: string;
  steps?: PlanStep[];
  phases?: Phase[];
  durationDays?: number;
  estimatedCost?: {
    tokens: number;
    dollars: number;
  };
  risks?: string[];
  autoApprove: boolean;
}

export interface Revision {
  timestamp: Timestamp;
  userMessage: string;
  agentResponse: string;
  draftBefore: PlanDraft;
  draftAfter: PlanDraft;
}

export interface LivingPlan {
  id: string;
  projectId: string;
  userId: string;
  goal: string;
  draft: PlanDraft;
  history: Revision[];
  status: PlanStatus;
  approvedAt?: Timestamp;
  executionRef?: {
    kind: 'atomic' | 'workflow' | 'timeline';
    id: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export class LivingPlanService {
  static async create(
    userId: string,
    projectId: string,
    goal: string,
    initialDraft: PlanDraft,
  ): Promise<LivingPlan> {
    const now = serverTimestamp();
    const planData: Omit<LivingPlan, 'id'> = {
      projectId,
      userId,
      goal,
      draft: initialDraft,
      history: [],
      status: 'drafting',
      createdAt: now as Timestamp,
      updatedAt: now as Timestamp,
    };

    const docRef = await addDoc(
      collection(db, 'projects', projectId, 'livingPlans'),
      planData,
    );

    return {
      id: docRef.id,
      ...planData,
    };
  }

  static async get(projectId: string, planId: string): Promise<LivingPlan | null> {
    const docRef = doc(db, 'projects', projectId, 'livingPlans', planId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists()
      ? ({ id: snapshot.id, ...snapshot.data() } as LivingPlan)
      : null;
  }

  static async updateDraft(
    projectId: string,
    planId: string,
    draft: PlanDraft,
  ): Promise<void> {
    const docRef = doc(db, 'projects', projectId, 'livingPlans', planId);
    await updateDoc(docRef, {
      draft,
      updatedAt: serverTimestamp(),
    });
  }

  static async addRevision(
    projectId: string,
    planId: string,
    revision: Omit<Revision, 'timestamp'>,
  ): Promise<void> {
    const docRef = doc(db, 'projects', projectId, 'livingPlans', planId);
    const plan = await this.get(projectId, planId);
    if (!plan) throw new Error('Plan not found');

    await updateDoc(docRef, {
      history: [
        ...plan.history,
        {
          ...revision,
          timestamp: serverTimestamp(),
        },
      ],
      updatedAt: serverTimestamp(),
    });
  }

  static async approve(
    projectId: string,
    planId: string,
  ): Promise<void> {
    const docRef = doc(db, 'projects', projectId, 'livingPlans', planId);
    await updateDoc(docRef, {
      status: 'awaiting_approval',
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  static async execute(
    projectId: string,
    planId: string,
    executionRef: LivingPlan['executionRef'],
  ): Promise<void> {
    const docRef = doc(db, 'projects', projectId, 'livingPlans', planId);
    await updateDoc(docRef, {
      status: 'executing',
      executionRef,
      updatedAt: serverTimestamp(),
    });
  }

  static async complete(
    projectId: string,
    planId: string,
  ): Promise<void> {
    const docRef = doc(db, 'projects', projectId, 'livingPlans', planId);
    await updateDoc(docRef, {
      status: 'completed',
      updatedAt: serverTimestamp(),
    });
  }

  static async listByProject(projectId: string): Promise<LivingPlan[]> {
    const q = query(
      collection(db, 'projects', projectId, 'livingPlans'),
      where('status', 'in', ['drafting', 'awaiting_approval', 'executing']),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as LivingPlan));
  }

  static async listAwaitingApproval(projectId: string): Promise<LivingPlan[]> {
    const q = query(
      collection(db, 'projects', projectId, 'livingPlans'),
      where('status', '==', 'awaiting_approval'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as LivingPlan));
  }
}
