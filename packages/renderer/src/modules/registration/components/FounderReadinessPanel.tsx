/**
 * FounderReadinessPanel — ISSUE-1121
 *
 * Tracks organization-level prerequisites that make identifier issuance,
 * DDEX delivery, and platform rights management legitimate.
 * Differentiates founder-level legal authority from per-track work registrations.
 */

import React, { useState } from 'react';
import { ExternalLink, ShieldAlert, CheckCircle2, Circle, Building2, Save, Sparkles, Compass } from 'lucide-react';
import type { FounderPrerequisite, FounderPrerequisiteId } from '../types';
import type { PortalTarget } from '@indii/shared';
import { logger } from '@/utils/logger';
import { RightsRegistrationWalkthroughModal } from './RightsRegistrationWalkthroughModal';
import { PREREQUISITE_STORAGE_KEY, parsePrerequisiteReports, serializePrerequisiteReports, reportPrerequisite, editPrerequisite, type PrerequisiteReports } from '../prerequisiteReports';

const COPILOT_PORTAL_MAP: Partial<Record<FounderPrerequisiteId, PortalTarget>> = {
  usco_org: 'loc_copyright',
  mlc_membership: 'the_mlc',
  pro_affiliation: 'bmi',
  soundexchange: 'soundexchange',
};

const PREREQUISITES: FounderPrerequisite[] = [
  {
    id: 'isrc_prefix',
    title: 'US ISRC Rights Owner Prefix',
    organization: 'US ISRC Agency',
    category: 'identity',
    feeDescription: '$95 one-time (up to 100,000 codes/year)',
    officialUrl: 'https://redesign.usisrc.org/apply-for-an-isrc-account/?user-is-manager=false',
    guidance: 'Apply using your legal entity or artist business name. Music videos require distinct ISRCs from audio recordings.',
    identifierLabel: 'Registered Registrant Code (e.g. QZ-XXX)',
    identifierPlaceholder: 'e.g. QZ-XXX',
  },
  {
    id: 'upc_prefix',
    title: 'GS1 GTIN / UPC Ownership',
    organization: 'GS1 US',
    category: 'identity',
    feeDescription: '$30 single GTIN (no renewal) or $250 initial / $50 annual prefix',
    officialUrl: 'https://store.gs1us.org/gs1-company-prefix/p',
    guidance: 'Official barcodes identify albums, singles, and physical merch across commercial retail and DSPs.',
    identifierLabel: 'GS1 Company Prefix or First GTIN-12',
    identifierPlaceholder: 'e.g. 012345678901',
  },
  {
    id: 'ddex_dpid',
    title: 'DDEX Implementation Licence & DPID',
    organization: 'DDEX Standards Organization',
    category: 'distribution',
    feeDescription: 'Free license (membership optional)',
    officialUrl: 'https://ddex.net/implementation/frequently-asked-questions/',
    guidance: 'Acquire your company Data Party Identifier (DPID) to authoritatively sign and send ERN 4.3 delivery feeds.',
    identifierLabel: 'Assigned DPID (Party ID)',
    identifierPlaceholder: 'e.g. PADY-XXXXXXXX',
  },
  {
    id: 'pro_affiliation',
    title: 'PRO Writer & Publisher Affiliation',
    organization: 'ASCAP / BMI / SESAC (CISAC)',
    category: 'royalties',
    feeDescription: 'Free to nominal application fee',
    officialUrl: 'https://www.cisac.org/services/information-services/ipi',
    guidance: 'Choose your society and review its writer and publisher requirements. A separate publishing company is not always required. Use only provider-issued IPI numbers.',
    identifierLabel: 'Authoritative Writer / Publisher IPI Number',
    identifierPlaceholder: 'e.g. 00123456789',
  },
  {
    id: 'mlc_membership',
    title: 'The Mechanical Licensing Collective',
    organization: 'The MLC',
    category: 'royalties',
    feeDescription: 'Free membership',
    officialUrl: 'https://www.themlc.com/membership',
    guidance: 'Register to collect US digital audio mechanical royalties for shares you or your publishing company self-administer.',
    identifierLabel: 'The MLC Publisher / Member ID',
    identifierPlaceholder: 'e.g. MLC-XXXXXX',
  },
  {
    id: 'soundexchange',
    title: 'SoundExchange Digital Performance Rights',
    organization: 'SoundExchange',
    category: 'royalties',
    feeDescription: 'Free registration',
    officialUrl: 'https://www.soundexchange.com/register/',
    guidance: 'Register for the featured performer and/or sound-recording copyright-owner roles you actually hold. Review existing representation before claiming recordings.',
    identifierLabel: 'SoundExchange Account Number',
    identifierPlaceholder: 'e.g. SX-XXXXXX',
  },
  {
    id: 'usco_org',
    title: 'U.S. Copyright Office Legal Organization Account',
    organization: 'U.S. Copyright Office',
    category: 'copyright',
    feeDescription: '$45 Single / $65 Standard electronic filing',
    officialUrl: 'https://www.copyright.gov/register/pa-sr.html',
    guidance: 'Establish your electronic Copyright Office (eCO) organization account for sound recording (SR) and performing arts (PA) claims.',
    identifierLabel: 'eCO User ID / Account Organization',
    identifierPlaceholder: 'e.g. eCO User Handle',
  },
];

const STORAGE_KEY = PREREQUISITE_STORAGE_KEY;

export function FounderReadinessPanel({ userId }: { userId: string }) {
  return <FounderReadinessWorkspace key={userId} userId={userId} />;
}

function FounderReadinessWorkspace({ userId }: { userId: string }) {
  const [data, setData] = useState<PrerequisiteReports>(() => {
    try {
      if (!userId) return {};
      const stored = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
      if (stored) {
        return parsePrerequisiteReports(stored);
      }
    } catch (err) {
      logger.warn('[FounderReadiness] Failed to load local readiness state', err);
    }
    return {};
  });
  const [saved, setSaved] = useState(false);
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);
  const [walkthroughPrereq, setWalkthroughPrereq] = useState<FounderPrerequisiteId>('pro_affiliation');

  const openWalkthrough = (id: FounderPrerequisiteId) => {
    setWalkthroughPrereq(id);
    setIsWalkthroughOpen(true);
  };

  const handleUpdatePrerequisite = (id: FounderPrerequisiteId, value: string, completed: boolean) => {
    setData((prev) => {
      const updated = {
        ...prev,
        [id]: reportPrerequisite(value, completed),
      };
      try {
        if (!userId) return updated;
        localStorage.setItem(`${STORAGE_KEY}_${userId}`, serializePrerequisiteReports(updated));
      } catch (err) {
        logger.error('[FounderReadiness] Failed to persist prerequisite update', err);
      }
      return updated;
    });
    setSaved(false);
  };

  const handleToggleCompleted = (id: FounderPrerequisiteId) => {
    setData((prev) => {
      const current = prev[id] || reportPrerequisite('', false);
      return {
        ...prev,
        [id]: reportPrerequisite(current.value, !current.completed),
      };
    });
    setSaved(false);
  };

  const handleValueChange = (id: FounderPrerequisiteId, value: string) => {
    setData((prev) => {
      const current = prev[id] || reportPrerequisite('', false);
      return {
        ...prev,
        [id]: editPrerequisite(current, value),
      };
    });
    setSaved(false);
  };

  const handleSave = () => {
    if (!userId) return;
    try {
      localStorage.setItem(`${STORAGE_KEY}_${userId}`, serializePrerequisiteReports(data));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      logger.error('[FounderReadiness] Failed to persist prerequisites', err);
    }
  };

  const completedCount = PREREQUISITES.filter((item) => data[item.id]?.completed).length;
  const progressPct = Math.round((completedCount / PREREQUISITES.length) * 100);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase tracking-widest mb-1">
            <Building2 size={16} />
            Organization & Rights Prerequisites (ISSUE-1121)
          </div>
          <h2 className="text-2xl font-black text-white">Founder Music-Identity Checklist</h2>
          <p className="text-sm text-neutral-400 mt-1 max-w-2xl">
            Commercial DDEX distribution and statutory royalty collection require verified agency registrations.
            Track-level metadata and app-generated drafts do not substitute for official organization credentials.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-mono text-neutral-400">Self-Reported Progress</div>
            <div className="text-xl font-black text-white">{progressPct}%</div>
          </div>
          <button
            type="button"
            onClick={() => openWalkthrough('pro_affiliation')}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-[#FFD700]/20 via-[#FFB800]/10 to-[#E65100]/20 hover:from-[#FFD700]/30 hover:to-[#FFB800]/20 text-[#FFD700] border border-[#FFB800]/40 text-xs font-bold rounded-lg transition-all shadow-[0_0_15px_rgba(255,184,0,0.15)]"
          >
            <Compass size={14} className="text-[#FFD700]" />
            <span>Setup Rights Copilot</span>
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold rounded-lg transition-colors"
          >
            <Save size={14} />
            {saved ? 'Saved!' : 'Save Progress'}
          </button>
        </div>
      </div>

      {/* Warning Callout */}
      <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200">
        <ShieldAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold block mb-0.5">Authoritative Registration Standard:</strong>
          indii helps prepare metadata and track your progress. Use official identifiers and only allocate ISRCs within an authorized registrant range. Your checkmarks record your own report of completion; they do not verify provider acceptance, ownership, eligibility or royalty payments.
        </div>
      </div>

      {/* Prerequisites List */}
      <div className="grid gap-4">
        {PREREQUISITES.map((item) => {
          const state = data[item.id] || reportPrerequisite('', false);
          return (
            <div
              key={item.id}
              className={`p-5 rounded-xl border transition-colors ${
                state.completed
                  ? 'bg-neutral-900/60 border-emerald-500/30'
                  : 'bg-neutral-900/30 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleCompleted(item.id)}
                      className="text-neutral-400 hover:text-white transition-colors"
                      aria-label={`${state.completed ? 'Mark pending' : 'Mark completed (self-reported)'}: ${item.title}`}
                      aria-pressed={state.completed}
                      title={`${state.completed ? 'Mark pending' : 'Mark completed (self-reported)'}: ${item.title}`}
                    >
                      {state.completed ? (
                        <CheckCircle2 size={18} className="text-emerald-400" />
                      ) : (
                        <Circle size={18} className="text-neutral-500" />
                      )}
                    </button>
                    <h3 className="text-sm font-bold text-white">{item.title}</h3>
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 text-neutral-400 border border-white/5">
                      {item.organization}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 pl-6">{item.guidance}</p>
                  <div className="text-[11px] font-mono text-amber-400/80 pl-6">Fee: {item.feeDescription}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-auto">
                  <button
                    type="button"
                    onClick={() => openWalkthrough(item.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#ffb800]/10 hover:bg-[#ffb800]/20 text-[#ffb800] border border-[#ffb800]/30 text-xs font-semibold transition-all shadow-sm"
                    title={`Open walkthrough guide for ${item.organization}`}
                    aria-label={`Open walkthrough guide for ${item.title}`}
                  >
                    <Sparkles size={12} />
                    <span>Guide</span>
                  </button>
                  {COPILOT_PORTAL_MAP[item.id] && (
                    <button
                      type="button"
                      onClick={() => window.open(item.officialUrl, '_blank', 'noopener,noreferrer')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 text-xs font-semibold transition-all shadow-sm"
                      title={`Launch guided Copilot assistant for ${item.organization}`}
                    >
                      <Sparkles size={12} />
                      <span>Open official portal</span>
                    </button>
                  )}
                  <a
                    href={item.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-amber-400 font-mono transition-colors"
                  >
                    Apply at {item.organization}
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              {/* Identifier Input */}
              <div className="mt-4 pt-3 border-t border-white/5 pl-6 flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="text-xs text-neutral-400 whitespace-nowrap">{item.identifierLabel}:</label>
                <input
                  type="text"
                  value={state.value}
                  onChange={(e) => handleValueChange(item.id, e.target.value)}
                  placeholder={item.identifierPlaceholder}
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Rights Registration Walkthrough Copilot Modal */}
      <RightsRegistrationWalkthroughModal
        isOpen={isWalkthroughOpen}
        onClose={() => setIsWalkthroughOpen(false)}
        initialPrerequisite={walkthroughPrereq}
        readinessData={data}
        onUpdatePrerequisite={handleUpdatePrerequisite}
      />
    </div>
  );
}
