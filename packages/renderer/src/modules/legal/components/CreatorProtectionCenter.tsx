import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, FileText, Fingerprint, Gavel, Link, Loader2, Scale, Shield, Siren } from 'lucide-react';
import { auth } from '@/services/firebase';
import {
  CREATOR_PROTECTION_SOURCES,
  creatorProtectionHarnessService,
  type IdentityProtectionProfile,
  type ReplicaIncident,
  type TakedownCase,
} from '@/services/creator-protection';

export function CreatorProtectionCenter() {
  const userId = auth.currentUser?.uid ?? null;
  const [artistName, setArtistName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [state, setState] = useState('');
  const [aiPermission, setAiPermission] = useState<IdentityProtectionProfile['aiVoiceLikenessPermission']>('not_authorized');
  const [monitoringOptIn, setMonitoringOptIn] = useState(false);
  const [biometricOptIn, setBiometricOptIn] = useState(false);
  const [profile, setProfile] = useState<IdentityProtectionProfile | null>(null);
  const [incidentText, setIncidentText] = useState('');
  const [incidentUrl, setIncidentUrl] = useState('');
  const [incident, setIncident] = useState<ReplicaIncident | null>(null);
  const [takedown, setTakedown] = useState<TakedownCase | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);

  const readinessRun = useMemo(() => {
    if (!profile) return null;
    return creatorProtectionHarnessService.compileReadiness({
      profile,
      works: [{
        workTitle: 'Priority release',
      }],
    });
  }, [profile]);

  const handleCompile = () => {
    if (!userId) return;
    setIsCompiling(true);
    const nextProfile = creatorProtectionHarnessService.createIdentityProtectionProfile({
      userId,
      artistName: artistName || undefined,
      legalName: legalName || undefined,
      state: state || undefined,
      aiVoiceLikenessPermission: aiPermission,
      monitoringOptIn,
      biometricFingerprintOptIn: biometricOptIn,
      trademarkStatus: 'search_needed',
      copyrightStatus: 'unknown',
    });
    setProfile(nextProfile);
    window.setTimeout(() => setIsCompiling(false), 250);
  };

  const handleClassifyIncident = () => {
    if (!userId) return;
    const nextIncident = creatorProtectionHarnessService.classifyIncident({
      userId,
      profileId: profile?.id,
      suspectedUrl: incidentUrl || undefined,
      description: incidentText || 'Suspected unauthorized AI identity misuse.',
    });
    const packet = creatorProtectionHarnessService.generateEvidencePacket({
      userId,
      profileId: profile?.id,
      incidentId: nextIncident.id,
      title: 'Creator protection evidence packet',
      evidenceRefs: incidentUrl ? [{ id: 'reported-url', type: 'url', label: 'Reported URL', url: incidentUrl }] : [],
    });
    const nextTakedown = creatorProtectionHarnessService.prepareTakedownDraft({
      userId,
      incident: nextIncident,
      packet,
      rightsholderName: artistName || legalName || undefined,
    });
    setIncident(nextIncident);
    setTakedown(nextTakedown);
  };

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-blue-400" />
            <h3 className="text-sm font-bold text-white">Creator Protection Profile</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Artist name" value={artistName} onChange={setArtistName} />
            <Field label="Legal name / entity" value={legalName} onChange={setLegalName} />
            <Field label="State / jurisdiction" value={state} onChange={setState} />
            <label className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">AI voice / likeness</span>
              <select
                value={aiPermission}
                onChange={(event) => setAiPermission(event.target.value as IdentityProtectionProfile['aiVoiceLikenessPermission'])}
                className="w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 text-xs text-white outline-none focus:border-blue-400"
              >
                <option value="not_authorized">Not authorized</option>
                <option value="case_by_case">Case by case</option>
                <option value="authorized_license_only">License only</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Toggle checked={monitoringOptIn} onChange={setMonitoringOptIn} label="Manual monitoring" />
            <Toggle checked={biometricOptIn} onChange={setBiometricOptIn} label="Fingerprinting review" />
          </div>
          <button
            onClick={handleCompile}
            disabled={isCompiling || !userId}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2"
          >
            {isCompiling ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Compile Protection Readiness
          </button>
        </div>

        <ReadinessCard run={readinessRun} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <StatusPanel
          icon={<Fingerprint size={15} className="text-cyan-300" />}
          title="Voice & Likeness Vault"
          rows={[
            ['Default permission', profile?.aiVoiceLikenessPermission.replaceAll('_', ' ') ?? 'not compiled'],
            ['Monitoring', profile?.monitoringOptIn ? 'manual intake on' : 'off'],
            ['Fingerprinting', profile?.biometricFingerprintOptIn ? 'requires review' : 'off'],
          ]}
        />
        <StatusPanel
          icon={<FileText size={15} className="text-emerald-300" />}
          title="Evidence Locker"
          rows={[
            ['Profile', profile ? profile.id : 'not compiled'],
            ['Evidence packets', takedown ? '1 draft packet' : 'none'],
            ['External filings', 'user approval required'],
          ]}
        />
        <StatusPanel
          icon={<Scale size={15} className="text-amber-300" />}
          title="Law Status"
          rows={CREATOR_PROTECTION_SOURCES.slice(0, 3).map(source => [source.label, source.status])}
        />
      </section>

      <section className="rounded-xl bg-white/[0.02] border border-white/5 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Siren size={16} className="text-red-400" />
          <h3 className="text-sm font-bold text-white">Takedown Wizard</h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-3">
          <label className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Incident summary</span>
            <textarea
              value={incidentText}
              onChange={(event) => setIncidentText(event.target.value)}
              rows={3}
              className="w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 text-xs text-white outline-none focus:border-red-400 resize-none"
              placeholder="AI voice clone, fake endorsement, copied song, impersonation..."
            />
          </label>
          <Field label="Reported URL" value={incidentUrl} onChange={setIncidentUrl} icon={<Link size={12} />} />
          <button
            onClick={handleClassifyIncident}
            className="self-end py-2.5 px-4 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 text-red-200 text-xs font-bold transition-colors flex items-center justify-center gap-2"
          >
            <Gavel size={14} />
            Draft Route
          </button>
        </div>

        {incident && takedown && (
          <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-4">
            <div className="rounded-lg bg-black/20 border border-white/5 p-3 space-y-2">
              <Badge label="Incident type" value={incident.incidentType.replaceAll('_', ' ')} />
              <Badge label="Route" value={incident.route.replaceAll('_', ' ')} />
              <Badge label="Severity" value={incident.severity} />
              <Badge label="Confidence" value={`${Math.round(incident.confidence * 100)}%`} />
            </div>
            <div className="rounded-lg bg-black/20 border border-white/5 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">{takedown.subject}</p>
              <pre className="text-[11px] text-gray-300 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto custom-scrollbar">
                {takedown.draftText}
              </pre>
            </div>
          </div>
        )}
      </section>

      <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3 flex items-start gap-2 text-xs text-amber-200/80">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>Drafts and readiness scores are operational support. Attorney review is required for filings, litigation, damages, contested rights, or uncertain law.</span>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, icon }: { label: string; value: string; onChange: (value: string) => void; icon?: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">{icon}</span>}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 text-xs text-white outline-none focus:border-blue-400 ${icon ? 'pl-8' : ''}`}
        />
      </div>
    </label>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 rounded-lg bg-white/[0.02] border border-white/5 p-2.5 text-xs text-white">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-blue-500" />
      {label}
    </label>
  );
}

function ReadinessCard({ run }: { run: ReturnType<typeof creatorProtectionHarnessService.compileReadiness> | null }) {
  const readiness = run?.output.readiness;
  return (
    <div className="rounded-xl bg-linear-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-blue-300" />
          <h3 className="text-sm font-bold text-white">Protection Readiness</h3>
        </div>
        <span className="text-2xl font-black text-white">{readiness?.score ?? 0}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${readiness?.score ?? 0}%` }} />
      </div>
      <div className="space-y-2">
        {(readiness?.nextActions ?? ['Compile a profile to create readiness actions.']).slice(0, 4).map(action => (
          <div key={action} className="flex items-start gap-2 text-xs text-gray-300">
            <CheckCircle size={12} className="text-blue-300 mt-0.5 shrink-0" />
            <span>{action}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPanel({ icon, title, rows }: { icon: React.ReactNode; title: string; rows: Array<[string, string]> }) {
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-xs font-bold text-white">{title}</h3>
      </div>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <Badge key={`${label}-${value}`} label={label} value={value} />
        ))}
      </div>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string; key?: React.Key }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] px-2.5 py-2">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-[11px] text-white font-bold text-right capitalize">{value}</span>
    </div>
  );
}
