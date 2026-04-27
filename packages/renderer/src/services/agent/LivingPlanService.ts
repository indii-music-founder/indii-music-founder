import { db } from '@/services/firebase';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  addDoc,
  Timestamp,
} from 'firebase/firestore';

export type PlanShape = 'atomic' | 'workflow' | 'timeline';
export type PlanStatus = 'drafting' | 'awaiting_approval' | 'executing' | 'proposed' | 'completed' | 'failed' | 'cancelled';

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  toolName?: string;
  input?: Record<string, unknown>;
  status: 'pending' | 'executing' | 'complete' | 'error';
  error?: string;
  result?: unknown;
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
  async create(
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

  async getPlan(projectId: string, planId: string): Promise<LivingPlan | null> {
    const docRef = doc(db, 'projects', projectId, 'livingPlans', planId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists()
      ? ({ id: snapshot.id, ...snapshot.data() } as LivingPlan)
      : null;
  }

  // Alias for backward compatibility or tool usage
  async get(projectId: string, planId: string): Promise<LivingPlan | null> {
    return this.getPlan(projectId, planId);
  }

  async getPlansForProject(projectId: string, status?: PlanStatus): Promise<LivingPlan[]> {
    const q = status 
      ? query(
          collection(db, 'projects', projectId, 'livingPlans'),
          where('status', '==', status),
        )
      : query(
          collection(db, 'projects', projectId, 'livingPlans'),
        );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as LivingPlan));
  }

  async updatePlanStatus(
    projectId: string,
    planId: string,
    status: PlanStatus
  ): Promise<void> {
    const docRef = doc(db, 'projects', projectId, 'livingPlans', planId);
    await updateDoc(docRef, {
      status,
      updatedAt: serverTimestamp(),
      ...(status === 'executing' ? { approvedAt: serverTimestamp() } : {})
    });
  }

  async updateDraft(
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

  async addRevision(
    projectId: string,
    planId: string,
    revision: Omit<Revision, 'timestamp'>,
  ): Promise<void> {
    const docRef = doc(db, 'projects', projectId, 'livingPlans', planId);
    const plan = await this.getPlan(projectId, planId);
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

  async approve(
    projectId: string,
    planId: string,
  ): Promise<void> {
    return this.updatePlanStatus(projectId, planId, 'executing');
  }

  async updateStepStatus(
    projectId: string,
    planId: string,
    stepId: string,
    status: PlanStep['status'],
    error?: string,
    result?: unknown,
  ): Promise<void> {
    const docRef = doc(db, 'projects', projectId, 'livingPlans', planId);
    const plan = await this.getPlan(projectId, planId);
    if (!plan || !plan.draft.steps) return;

    const newSteps = plan.draft.steps.map(step => {
      if (step.id === stepId) {
        return { ...step, status, error, result };
      }
      return step;
    });

    await updateDoc(docRef, {
      'draft.steps': newSteps,
      updatedAt: serverTimestamp(),
    });
  }

  async cancel(
    projectId: string,
    planId: string,
  ): Promise<void> {
    return this.updatePlanStatus(projectId, planId, 'cancelled');
  }

  async complete(
    projectId: string,
    planId: string,
  ): Promise<void> {
    return this.updatePlanStatus(projectId, planId, 'completed');
  }

  async listByProject(projectId: string): Promise<LivingPlan[]> {
    const q = query(
      collection(db, 'projects', projectId, 'livingPlans'),
      where('status', 'in', ['drafting', 'awaiting_approval', 'executing', 'proposed']),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as LivingPlan));
  }
}

export const livingPlanService = new LivingPlanService();
