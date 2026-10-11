/**
 * RightsCopilotModal.tsx
 *
 * Interactive Copilot Drawer & Assistant Modal for ISSUE-1511:
 * Assisted Rights Registration Engine — Screen Control & Browser Copilot
 * for Official Music Rights Infrastructure (US Copyright Office eCO, The MLC, PROs, SoundExchange).
 *
 * Hybrid-safe (works seamlessly in Electron and Web browser).
 */

import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  Compass,
  Copy,
  ExternalLink,
  FileCheck,
  FileMusic,
  Loader2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  DepositAsset,
  PortalTarget,
  RightsRegistrationManifest,
} from '@indii/shared';
import { rightsCopilotService } from '@/services/rights/RightsCopilotService';

export interface RightsCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  portalTarget: PortalTarget;
  initialManifest?: RightsRegistrationManifest;
  artistLegalName?: string;
  artistStageName?: string;
  workTitle?: string;
}

const PORTAL_METADATA: Record<
  PortalTarget,
  {
    name: string;
    organization: string;
    officialUrl: string;
    fee: string;
    description: string;
  }
> = {
  loc_copyright: {
    name: 'U.S. Copyright Office eCO Registration',
    organization: 'Library of Congress',
    officialUrl: 'https://eco.copyright.gov/ecoms/',
    fee: '$45 Single / $65 Standard filing',
    description: 'Establishes prima facie evidence of sound recording (SR) and composition (PA) ownership under US federal law.',
  },
  the_mlc: {
    name: 'The Mechanical Licensing Collective',
    organization: 'The MLC',
    officialUrl: 'https://portal.themlc.com/',
    fee: 'Free membership',
    description: 'Collects and distributes 100% of US digital audio mechanical royalties from interactive streaming services.',
  },
  bmi: {
    name: 'BMI Performing Rights Organization',
    organization: 'Broadcast Music, Inc.',
    officialUrl: 'https://www.bmi.com/join',
    fee: 'Free songwriter application',
    description: 'Collects public performance royalties across radio, TV, digital streaming, and live venues.',
  },
  ascap: {
    name: 'ASCAP Performing Rights Organization',
    organization: 'ASCAP',
    officialUrl: 'https://www.ascap.com/join',
    fee: '$50 one-time application fee',
    description: 'Collects public performance royalties worldwide for songwriters, composers, and music publishers.',
  },
  soundexchange: {
    name: 'SoundExchange Digital Performance',
    organization: 'SoundExchange',
    officialUrl: 'https://www.soundexchange.com/register/',
    fee: 'Free registration',
    description: 'Collects non-interactive digital radio streaming royalties for featured recording artists and master rights owners.',
  },
  hfa: {
    name: 'Harry Fox Agency / Songfile',
    organization: 'HFA / SESAC',
    officialUrl: 'https://www.songfile.com/',
    fee: 'Free catalog indexing',
    description: 'Administers mechanical licensing, DPDs, and physical reproduction rights in the United States.',
  },
};

export const RightsCopilotModal: React.FC<RightsCopilotModalProps> = ({
  isOpen,
  onClose,
  portalTarget,
  initialManifest,
  artistLegalName = 'Independent Artist',
  artistStageName,
  workTitle = 'New Release',
}) => {
  const portalInfo = PORTAL_METADATA[portalTarget] || PORTAL_METADATA.loc_copyright;

  const [manifest, setManifest] = useState<RightsRegistrationManifest>(() => {
    if (initialManifest) return initialManifest;
    return rightsCopilotService.createManifestFromPassport(
      { artistName: artistLegalName },
      {
        title: workTitle,
        artistLegalName,
        artistStageName,
      },
    );
  });

  const [isHashing, setIsHashing] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [copiedDossier, setCopiedDossier] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);

  if (!isOpen) return null;

  const actions = rightsCopilotService.getActionPlan(manifest, portalTarget);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDepositError(null);
    setIsHashing(true);

    try {
      const buffer = typeof file.arrayBuffer === 'function'
        ? await file.arrayBuffer()
        : await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
          });
      const checksum = await rightsCopilotService.computeAudioChecksum(buffer);

      const mime = file.type === 'audio/wav' || file.name.endsWith('.wav')
        ? 'audio/wav'
        : file.type === 'audio/mpeg' || file.name.endsWith('.mp3')
        ? 'audio/mpeg'
        : file.type === 'audio/flac' || file.name.endsWith('.flac')
        ? 'audio/flac'
        : 'audio/wav';

      const depositAsset: DepositAsset = {
        filename: file.name,
        fileSizeBytes: file.size,
        mimeType: mime,
        sha256Checksum: checksum,
        localPath: (file as unknown as { path?: string }).path,
      };

      const result = rightsCopilotService.attachDeposit(manifest, depositAsset);
      if (result.isValid) {
        setManifest(result.manifest);
      } else {
        setDepositError(result.errors.join(', '));
      }
    } catch (err) {
      setDepositError(err instanceof Error ? err.message : 'Failed to process deposit audio file');
    } finally {
      setIsHashing(false);
    }
  };

  const handleCopyDossier = () => {
    const brief = rightsCopilotService.generateFilingBrief(manifest);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(brief);
    }
    setCopiedDossier(true);
    window.setTimeout(() => setCopiedDossier(false), 2000);
  };

  const handleLaunchRegistration = async () => {
    setSessionActive(true);
    // If Electron IPC is available, request native browser session
    if (typeof window !== 'undefined' && window.electronAPI && (window.electronAPI as unknown as { rightsCopilot?: { launchSession: (req: unknown) => Promise<{ success: boolean }> } }).rightsCopilot) {
      try {
        await (window.electronAPI as unknown as { rightsCopilot: { launchSession: (req: unknown) => Promise<{ success: boolean }> } }).rightsCopilot.launchSession({
          portalTarget,
          manifestId: manifest.manifestId,
          targetUrl: portalInfo.officialUrl,
        });
        return;
      } catch (err) {
        console.warn('[RightsCopilot] Electron native copilot session failed, falling back to browser tab', err);
      }
    }

    // Web fallback: Open official portal in new secure window
    window.open(portalInfo.officialUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0d0d0d] p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/5 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-[#ffb800]" />
              <h3 className="text-lg font-bold text-white">{portalInfo.name}</h3>
            </div>
            <p className="text-xs text-white/50 mt-1">{portalInfo.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Work & Claimant Summary Card */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] text-white/40 uppercase font-semibold">Work Title</div>
            <div className="text-xs font-bold text-white mt-0.5 truncate" title={manifest.work.title}>
              {manifest.work.title}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] text-white/40 uppercase font-semibold">Claimant / Author</div>
            <div className="text-xs font-bold text-white mt-0.5 truncate" title={manifest.artistLegalName}>
              {manifest.artistLegalName}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] text-white/40 uppercase font-semibold">Official Fee</div>
            <div className="text-xs font-bold text-[#ffb800] mt-0.5 truncate">{portalInfo.fee}</div>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="text-[10px] text-white/40 uppercase font-semibold">Organization</div>
            <div className="text-xs font-bold text-white mt-0.5 truncate">{portalInfo.organization}</div>
          </div>
        </div>

        {/* Deposit Audio Staging (US Copyright Office eCO) */}
        {portalTarget === 'loc_copyright' && (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileMusic className="w-4 h-4 text-[#ffb800]" />
                <h4 className="text-xs font-bold text-white">Deposit Copy Staging (Library of Congress)</h4>
              </div>
              <span className="text-[10px] text-white/40 font-mono">WAV / MP3 / FLAC</span>
            </div>

            {manifest.depositAssets.length === 0 ? (
              <label className="flex flex-col items-center justify-center border border-dashed border-white/10 hover:border-[#ffb800]/40 rounded-xl p-4 cursor-pointer transition-colors">
                <Upload className="w-5 h-5 text-white/40 mb-1.5" />
                <span className="text-xs text-white/80 font-medium">Select Master Audio File</span>
                <span className="text-[10px] text-white/30 mt-0.5">Calculates deterministic SHA-256 for eCO filing verification</span>
                <input
                  type="file"
                  accept="audio/wav,audio/mpeg,audio/flac"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isHashing}
                />
              </label>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-emerald-300">
                      {manifest.depositAssets[0].filename}
                    </div>
                    <div className="text-[10px] text-emerald-400/70 font-mono">
                      SHA-256: {manifest.depositAssets[0].sha256Checksum.slice(0, 16)}...
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                  Verified Deposit
                </span>
              </div>
            )}

            {isHashing && (
              <div className="flex items-center gap-2 text-xs text-[#ffb800]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Computing SHA-256 binary checksum...</span>
              </div>
            )}

            {depositError && (
              <div className="text-xs text-rose-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{depositError}</span>
              </div>
            )}
          </div>
        )}

        {/* Step-by-Step Copilot Action Plan */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#ffb800]" />
              <span>Copilot Navigation Plan ({actions.length} Steps)</span>
            </h4>
            <span className="text-[10px] text-emerald-400 font-mono">100% Privacy Preserving</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {actions.map((act, idx) => (
              <div
                key={act.id}
                className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-2.5 text-xs"
              >
                <span className="font-mono text-[10px] text-white/30 shrink-0 mt-0.5">
                  {idx + 1}.
                </span>
                <div className="flex-1">
                  <div className="text-white/90 font-medium">{act.description}</div>
                  {act.targetSelector && (
                    <div className="text-[10px] font-mono text-white/30 mt-0.5">
                      Target: {act.targetSelector}
                    </div>
                  )}
                </div>
                {act.requiresUserAction ? (
                  <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded shrink-0">
                    User Action
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded shrink-0">
                    Copilot Autofill
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Security & Credentials Guarantee */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-white/60 leading-relaxed">
          <span className="font-semibold text-white">indii Privacy Guarantee: </span>
          Government and society passwords, CAPTCHAs, and payment card inputs remain strictly in your local browser session. indii never stores or intercepts your login credentials.
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={handleCopyDossier}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/80 transition-colors"
          >
            {copiedDossier ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedDossier ? 'Dossier Copied!' : 'Export Filing Dossier'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/70 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleLaunchRegistration()}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#ffb800] text-black font-bold text-xs hover:bg-[#ffb800]/90 transition-all shadow-md"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{sessionActive ? 'Re-open Registration' : 'Launch Assisted Registration'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
