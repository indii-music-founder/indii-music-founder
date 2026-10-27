import React, { useState } from 'react';
import { Music2, Info, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CatalogTrack, OrgId, TrackRegistrationState, SubmissionResult } from '../types';
import { ORG_ADAPTERS } from '../adapters';
import { OrgStatusCard } from './OrgStatusCard';
import { RegistrationForm } from './RegistrationForm';
import { RightsRegistrationWalkthroughModal } from './RightsRegistrationWalkthroughModal';

interface RegistrationSheetProps {
  track: CatalogTrack | null;
  focusedOrgId: OrgId | null;
  registrationState: TrackRegistrationState | null;
  userId: string;
  onOrgSelect: (orgId: OrgId) => void;
  onSubmitComplete: (orgId: OrgId, result: SubmissionResult) => void;
  selectedProId?: 'ascap' | 'bmi' | 'sesac' | null;
}

// All orgs shown, in a logical order
const ORG_ORDER: OrgId[] = ['loc', 'ascap', 'bmi', 'sesac', 'soundexchange', 'mlc'];

export function RegistrationSheet({
  track,
  focusedOrgId,
  registrationState,
  userId,
  onOrgSelect,
  onSubmitComplete,
  selectedProId,
}: RegistrationSheetProps) {
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);

  if (!track) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-3">
        <Music2 size={32} className="opacity-20" />
        <p className="text-sm">Select a track from your catalog</p>
      </div>
    );
  }

  // Filter org list: only show one PRO (whichever the artist chose)
  const visibleOrgs = ORG_ORDER.filter(orgId => {
    const isProOrg = ['ascap', 'bmi', 'sesac'].includes(orgId);
    if (!isProOrg) return true;
    if (!selectedProId) return true; // show all PROs if none chosen
    return orgId === selectedProId;
  });

  const focusedAdapter = focusedOrgId ? ORG_ADAPTERS[focusedOrgId] : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Track header */}
      <div className="px-5 py-4 border-b border-white/[0.05] flex-shrink-0">
        <h2 className="text-base font-semibold text-white truncate">{track.title}</h2>
        <p className="text-sm text-gray-500 truncate">{track.artistName}</p>
        {registrationState && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1 bg-white/[0.05] rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${registrationState.completenessScore}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{registrationState.completenessScore}% registered</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Org cards grid */}
        <div className="p-4 space-y-2">
          {visibleOrgs.map(orgId => {
            const adapter = ORG_ADAPTERS[orgId];
            const record = registrationState?.orgs[orgId];
            return (
              <OrgStatusCard
                key={orgId}
                adapter={adapter}
                status={record?.status ?? 'not_started'}
                confirmationNumber={record?.confirmationNumber ?? undefined}
                isSelected={focusedOrgId === orgId}
                onSelect={() => onOrgSelect(orgId)}
              />
            );
          })}

          {!selectedProId && (
            <div className="flex items-center justify-between gap-3 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl mt-3">
              <div className="flex items-start gap-2">
                <Info size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200">
                  You haven't chosen a performing rights organization (PRO) yet. Affiliate with ASCAP, BMI, or SESAC to collect performance royalties.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsWalkthroughOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFB800] text-black text-xs font-bold hover:brightness-110 transition-all shrink-0 shadow-sm"
              >
                <Sparkles size={12} />
                <span>PRO Guide</span>
              </button>
            </div>
          )}
        </div>

        {/* Inline form for focused org */}
        {focusedAdapter && (
          <div className={cn(
            'mx-4 mb-4 p-4 rounded-xl border border-white/[0.08] bg-white/[0.02]'
          )}>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-white">{focusedAdapter.name} Registration</h3>
              {focusedAdapter.timeline && (
                <p className="text-xs text-gray-600 mt-0.5">Processing time: {focusedAdapter.timeline}</p>
              )}
            </div>
            <RegistrationForm
              adapter={focusedAdapter}
              track={track}
              userId={userId}
              onSubmitComplete={(result) => onSubmitComplete(focusedOrgId!, result)}
            />
          </div>
        )}
      </div>

      {/* Rights Registration Walkthrough Modal */}
      <RightsRegistrationWalkthroughModal
        isOpen={isWalkthroughOpen}
        onClose={() => setIsWalkthroughOpen(false)}
        initialPrerequisite="pro_affiliation"
      />
    </div>
  );
}
