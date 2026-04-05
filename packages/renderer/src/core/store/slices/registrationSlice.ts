import { StateCreator } from 'zustand';
import type { OrgId, TrackRegistrationState, RegistrationFocus, OrgRegistrationRecord } from '@/modules/registration/types';

export interface RegistrationSlice {
  registrationFocus: RegistrationFocus;
  setRegistrationFocus: (focus: RegistrationFocus) => void;

  registrationStates: Record<string, TrackRegistrationState>;
  setTrackRegistrationState: (trackId: string, state: TrackRegistrationState) => void;
  updateOrgRecord: (trackId: string, orgId: OrgId, record: OrgRegistrationRecord) => void;

  // One-shot message bus: AgentOrchestrator/navigate_to pushes a message here;
  // RegistrationAIRail consumes and clears it. Not persisted.
  registrationAIMessage: string;
  setRegistrationAIMessage: (message: string) => void;
}

export const createRegistrationSlice: StateCreator<RegistrationSlice> = (set) => ({
  registrationFocus: { trackId: null, orgId: null },
  setRegistrationFocus: (focus) => set({ registrationFocus: focus }),

  registrationStates: {},
  setTrackRegistrationState: (trackId, state) =>
    set((s) => ({
      registrationStates: { ...s.registrationStates, [trackId]: state },
    })),
  updateOrgRecord: (trackId, orgId, record) =>
    set((s) => {
      const existing = s.registrationStates[trackId] ?? {
        trackId,
        orgs: {},
        completenessScore: 0,
      };
      const updatedOrgs = { ...existing.orgs, [orgId]: record };
      const confirmed = Object.values(updatedOrgs).filter((r) => r.status === 'confirmed').length;
      const total = Object.keys(updatedOrgs).length || 1;
      return {
        registrationStates: {
          ...s.registrationStates,
          [trackId]: {
            ...existing,
            orgs: updatedOrgs,
            completenessScore: Math.round((confirmed / total) * 100),
          },
        },
      };
    }),

  registrationAIMessage: '',
  setRegistrationAIMessage: (message) => set({ registrationAIMessage: message }),
});
