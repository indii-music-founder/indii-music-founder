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
  dependsOn?: string[];
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
  /**
   * Create a new living plan.
   */
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

  /**
   * Retrieve a specific plan by ID.
   */
  async getPlan(projectId: string, planId: string): Promise<LivingPlan | null> {
    const docRef = doc(db, 'projects', projectId, 'livingPlans', planId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists()
      ? ({ id: snapshot.id, ...snapshot.data() } as LivingPlan)
      : null;
  }

  /**
   * Alias for getPlan.
   */
  async get(projectId: string, planId: string): Promise<LivingPlan | null> {
    return this.getPlan(projectId, planId);
  }

  /**
   * List all plans for a project, optionally filtered by status.
   */
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
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as LivingPlan));
  }

  /**
   * Update the status of a plan.
   */
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

  /**
   * Update the draft of a plan.
   */
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

  /**
   * Add a revision to the plan's history.
   */
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

  /**
   * Approve a plan and set it to executing.
   */
  async approve(
    projectId: string,
    planId: string,
  ): Promise<void> {
    return this.updatePlanStatus(projectId, planId, 'executing');
  }

  /**
   * Update the status of a specific step in the plan.
   */
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

  /**
   * Execute a plan by associating it with an execution reference.
   */
  async execute(
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

  /**
   * Orchestrate execution of plan steps via Promise.all for parallelism using A2A Swarm.
   */
  async executePlanSteps(projectId: string, planId: string): Promise<void> {
    const plan = await this.getPlan(projectId, planId);
    if (!plan || !plan.draft.steps) return;

    const { a2aClient } = await import('./a2a/A2AClient');
    const steps = plan.draft.steps;
    const completed = new Set<string>();
    const pending = new Set(steps.map(s => s.id));
    const executing = new Set<string>();

    const executeStep = async (stepId: string) => {
      const step = steps.find(s => s.id === stepId);
      if (!step || !step.toolName) return;

      executing.add(stepId);
      await this.updateStepStatus(projectId, planId, stepId, 'executing');

      try {
        // Find the target agent for this step (assuming toolName indicates agent or we have a default mapping)
        // Wait, the instruction says "Orchestrate dependent steps via Promise.all".
        // Let's assume the toolName format is "agentId.toolName" or we just use consult_specialist
        // If it's a living plan, usually the step specifies the task.
        const agentId = step.toolName.split('.')[0] || 'generalist';
        const method = step.toolName.split('.')[1] || 'execute';

        const result = await a2aClient.invoke(
          agentId, 
          method, 
          step.input || {}, 
          { id: crypto.randomUUID(), type: 'PLAN_STEP', status: 'in_progress', title: step.title, steps: [], createdAt: Date.now(), updatedAt: Date.now() } as any
        );

        await this.updateStepStatus(projectId, planId, stepId, 'complete', undefined, result);
        completed.add(stepId);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        await this.updateStepStatus(projectId, planId, stepId, 'error', message);
      } finally {
        executing.delete(stepId);
        pending.delete(stepId);
      }
    };

    while (pending.size > 0) {
      const runnableSteps = Array.from(pending).filter(stepId => {
        const step = steps.find(s => s.id === stepId);
        if (executing.has(stepId)) return false;
        if (!step?.dependsOn || step.dependsOn.length === 0) return true;
        return step.dependsOn.every(dep => completed.has(dep));
      });

      if (runnableSteps.length === 0 && executing.size === 0) {
        // Deadlock or unresolvable dependencies
        break;
      }

      await Promise.all(runnableSteps.map(stepId => executeStep(stepId)));
    }
  }

  /**
   * Cancel a plan.
   */
  async cancel(
    projectId: string,
    planId: string,
  ): Promise<void> {
    return this.updatePlanStatus(projectId, planId, 'cancelled');
  }

  /**
   * Complete a plan.
   */
  async complete(
    projectId: string,
    planId: string,
  ): Promise<void> {
    return this.updatePlanStatus(projectId, planId, 'completed');
  }

  /**
   * List plans for a project that are currently in a "live" state.
   */
  async listByProject(projectId: string): Promise<LivingPlan[]> {
    const q = query(
      collection(db, 'projects', projectId, 'livingPlans'),
      where('status', 'in', ['drafting', 'awaiting_approval', 'executing', 'proposed']),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as LivingPlan));
  }

  /**
   * List plans awaiting approval.
   */
  async listAwaitingApproval(projectId: string): Promise<LivingPlan[]> {
    const q = query(
      collection(db, 'projects', projectId, 'livingPlans'),
      where('status', '==', 'awaiting_approval'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as LivingPlan));
  }
}

export const livingPlanService = new LivingPlanService();
