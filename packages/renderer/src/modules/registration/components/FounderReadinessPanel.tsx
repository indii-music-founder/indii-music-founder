/**
 * FounderReadinessPanel — ISSUE-1121
 *
 * Tracks organization-level prerequisites that make identifier issuance,
 * DDEX delivery, and platform rights management legitimate.
 * Differentiates founder-level legal authority from per-track work registrations.
 */

import React, { useState } from 'react';
import { ExternalLink, ShieldAlert, CheckCircle2, Circle, Building2, Save } from 'lucide-react';
import type { FounderPrerequisite, FounderPrerequisiteId } from '../types';
import { logger } from '@/utils/logger';

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
    guidance: 'Join as writer and consider separate publishing entity. IPI numbers are authoritative system data—never app-generated.',
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
    guidance: 'Register both featured performer and sound-recording copyright-owner roles to collect non-interactive digital performance royalties.',
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

const STORAGE_KEY = 'indii_founder_readiness_prerequisites_v1';

export function FounderReadinessPanel({ userId }: { userId: string }) {
  const [data, setData] = useState<Record<string, { verified: boolean; value: string }>>(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      logger.warn('[FounderReadiness] Failed to load local readiness state', err);
    }
    return {};
  });
  const [saved, setSaved] = useState(false);

  const handleToggleVerified = (id: FounderPrerequisiteId) => {
    setData((prev) => {
      const current = prev[id] || { verified: false, value: '' };
      return {
        ...prev,
        [id]: { ...current, verified: !current.verified },
      };
    });
    setSaved(false);
  };

  const handleValueChange = (id: FounderPrerequisiteId, value: string) => {
    setData((prev) => {
      const current = prev[id] || { verified: false, value: '' };
      return {
        ...prev,
        [id]: { ...current, value },
      };
    });
    setSaved(false);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(data));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      logger.error('[FounderReadiness] Failed to persist prerequisites', err);
    }
  };

  const verifiedCount = Object.values(data).filter((item) => item.verified).length;
  const progressPct = Math.round((verifiedCount / PREREQUISITES.length) * 100);

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
            <div className="text-xs font-mono text-neutral-400">Readiness Score</div>
            <div className="text-xl font-black text-white">{progressPct}%</div>
          </div>
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
          indii assists in preparing DDEX packages and metadata, but never self-mints official ISRCs, UPCs, or IPIs without your verified organization prefixes. Registering directly with these official bodies ensures your ownership and royalties remain unencumbered.
        </div>
      </div>

      {/* Prerequisites List */}
      <div className="grid gap-4">
        {PREREQUISITES.map((item) => {
          const state = data[item.id] || { verified: false, value: '' };
          return (
            <div
              key={item.id}
              className={`p-5 rounded-xl border transition-colors ${
                state.verified
                  ? 'bg-neutral-900/60 border-emerald-500/30'
                  : 'bg-neutral-900/30 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleVerified(item.id)}
                      className="text-neutral-400 hover:text-white transition-colors"
                      title={state.verified ? 'Mark pending' : 'Mark verified'}
                    >
                      {state.verified ? (
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

                <a
                  href={item.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-amber-400 font-mono transition-colors shrink-0 self-start md:self-auto"
                >
                  Apply at {item.organization}
                  <ExternalLink size={12} />
                </a>
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
    </div>
  );
}
