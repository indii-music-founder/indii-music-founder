import React, { useMemo } from 'react';
import { GitMerge, Shield, WalletCards } from 'lucide-react';
import { boardroomMetaHarnessService } from '@/services/business-harness';

export function HarnessDecisionDigest() {
  const decision = useMemo(() => boardroomMetaHarnessService.createDecision({
    userId: 'founder-demo-uid',
    requestedAction: 'cross-domain music business action',
    runs: [],
  }), []);

  return (
    <div className="border-b border-white/5 bg-white/[0.015] px-4 py-3">
      <div className="grid grid-cols-3 gap-2">
        <DigestItem icon={<GitMerge size={13} />} label="Meta Harness" value={decision.mode.replace('_', ' ')} />
        <DigestItem icon={<Shield size={13} />} label="Legal Risk" value={decision.legalRisk} />
        <DigestItem icon={<WalletCards size={13} />} label="Cost Impact" value={`$${decision.costImpact.total.toFixed(0)}`} />
      </div>
    </div>
  );
}

function DigestItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/20 border border-white/5 px-3 py-2 min-w-0">
      <div className="flex items-center gap-1.5 text-white/30 mb-1">
        {icon}
        <span className="text-[9px] uppercase tracking-widest font-bold truncate">{label}</span>
      </div>
      <p className="text-xs text-white/80 font-bold capitalize truncate">{value}</p>
    </div>
  );
}

