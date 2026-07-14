import { StateCreator } from 'zustand';
import type { OrgId, TrackRegistrationState, RegistrationFocus, OrgRegistrationRecord } from '@/modules/registration/types';

// Canonical required orgs for full registration completeness
// Legal: LoC (optional), PRO (exactly one of ASCAP/BMI/SESAC), SoundExchange (required), MLC (required)
const REQUIRED_ORGS: OrgId[] = ['soundexchange', 'mlc'];
const PRO_ORGS: OrgId[] = ['ascap', 'bmi', 'sesac'];

function computeCompleteness(orgs: Partial<Record<OrgId, OrgRegistrationRecord>>, selectedPro?: OrgId): number {
  const requiredSet = new Set<OrgId>(REQUIRED_ORGS);
  if (selectedPro) requiredSet.add(selectedPro);

  let confirmed = 0;
  requiredSet.forEach(orgId => {
    if (orgs[orgId]?.status === 'confirmed') confirmed++;
  });

  return Math.round((confirmed / requiredSet.size) * 100);
}

export interface RegistrationSlice {
  registrationFocus: RegistrationFocus;
  setRegistrationFocus: (focus: RegistrationFocus) => void;

  registrationStates: Record<string, TrackRegistrationState>;
  setTrackRegistrationState: (trackId: string, state: TrackRegistrationState) => void;
  updateOrgRecord: (trackId: string, orgId: OrgId, record: OrgRegistrationRecord) => void;

  // One-shot message bus: AgentOrchestrator/navigate_to pushes a message here;
  // RegistrationIntelligenceRail consumes and clears it. Not persisted.
  registrationIntelligenceMessage: string;
  setRegistrationIntelligenceMessage: (message: string) => void;
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
      // Find the selected PRO (first confirmed among PRO_ORGS)
      const selectedPro = PRO_ORGS.find(pro => updatedOrgs[pro]?.status === 'confirmed') as OrgId | undefined;
      const completenessScore = computeCompleteness(updatedOrgs, selectedPro);
      return {
        registrationStates: {
          ...s.registrationStates,
          [trackId]: {
            ...existing,
            orgs: updatedOrgs,
            completenessScore,
          },
        },
      };
    }),

  registrationIntelligenceMessage: '',
  setRegistrationIntelligenceMessage: (message) => set({ registrationIntelligenceMessage: message }),
});
