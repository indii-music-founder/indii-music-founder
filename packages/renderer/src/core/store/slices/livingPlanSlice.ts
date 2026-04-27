import { create } from 'zustand';
import type { LivingPlan, PlanDraft } from '@/services/agent/LivingPlanService';
import { Timestamp } from 'firebase/firestore';

interface LivingPlanSlice {
  selectedPlanId: string | null;
  selectedPlan: LivingPlan | null;
  plans: Map<string, LivingPlan>;
  isLoading: boolean;
  error: string | null;

  setSelectedPlan: (plan: LivingPlan | null) => void;
  setSelectedPlanId: (planId: string | null) => void;
  setPlan: (plan: LivingPlan) => void;
  updateDraft: (planId: string, draft: PlanDraft) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearSelected: () => void;
}

export const useLivingPlanSlice = create<LivingPlanSlice>((set) => ({
  selectedPlanId: null,
  selectedPlan: null,
  plans: new Map(),
  isLoading: false,
  error: null,

  setSelectedPlan: (plan) =>
    set({
      selectedPlanId: plan?.id ?? null,
      selectedPlan: plan,
      error: null,
    }),

  setSelectedPlanId: (planId) =>
    set((state) => ({
      selectedPlanId: planId,
      selectedPlan: planId ? state.plans.get(planId) || null : null,
      error: null,
    })),

  setPlan: (plan) =>
    set((state) => {
      const newPlans = new Map(state.plans);
      newPlans.set(plan.id, plan);
      return {
        plans: newPlans,
        selectedPlan:
          state.selectedPlanId === plan.id
            ? plan
            : state.selectedPlan,
      };
    }),

  updateDraft: (planId, draft) =>
    set((state) => {
      const plan = state.plans.get(planId);
      if (!plan) return state;

      const updated: LivingPlan = { ...plan, draft, updatedAt: Timestamp.now() };
      const newPlans = new Map(state.plans);
      newPlans.set(planId, updated);

      return {
        plans: newPlans,
        selectedPlan:
          state.selectedPlanId === planId
            ? updated
            : state.selectedPlan,
      };
    }),

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearSelected: () =>
    set({
      selectedPlanId: null,
      selectedPlan: null,
    }),
}));
