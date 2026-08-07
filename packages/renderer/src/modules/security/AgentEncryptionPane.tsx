import React, { useEffect, useState } from 'react';
import { Shield, ShieldCheck } from 'lucide-react';
import { e2eEncryptionService } from '@/services/security/E2EEncryptionService';

interface EncryptionDiagnostics {
    localAgentIds: string[];
    registeredPeerIds: string[];
    peersWithVerifiedSigning: string[];
    activeSessionCount: number;
}

const POLL_INTERVAL_MS = 5000;

export function AgentEncryptionPane() {
    const [diagnostics, setDiagnostics] = useState<EncryptionDiagnostics | null>(null);

    useEffect(() => {
        const refresh = () => setDiagnostics(e2eEncryptionService.getDiagnostics());
        refresh();
        const interval = setInterval(refresh, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    if (!diagnostics) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                <span className="animate-pulse">Loading encryption diagnostics...</span>
            </div>
        );
    }

    if (diagnostics.localAgentIds.length === 0 && diagnostics.registeredPeerIds.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <Shield size={32} className="mb-3 opacity-20" />
                <span className="font-bold uppercase tracking-widest text-[10px]">No Active Swarm Sessions</span>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg flex items-start gap-3">
                <ShieldCheck size={16} className="text-green-400 mt-0.5" />
                <div className="flex-1 min-w-0 text-[10px] text-gray-400 space-y-1">
                    <div>Local key pairs: <span className="text-white font-medium">{diagnostics.localAgentIds.length}</span></div>
                    <div>Registered peers: <span className="text-white font-medium">{diagnostics.registeredPeerIds.length}</span></div>
                    <div>Peers with verified signing: <span className="text-white font-medium">{diagnostics.peersWithVerifiedSigning.length}</span></div>
                    <div>Active session keys: <span className="text-white font-medium">{diagnostics.activeSessionCount}</span></div>
                </div>
            </div>
            {diagnostics.registeredPeerIds.map((peerId) => (
                <div key={peerId} className="p-3 bg-white/[0.02] border border-white/5 rounded-lg flex items-center gap-3">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    <span className="text-xs text-white truncate">{peerId}</span>
                    <span className="ml-auto text-[10px] text-gray-500">
                        {diagnostics.peersWithVerifiedSigning.includes(peerId) ? 'signed' : 'unsigned'}
                    </span>
                </div>
            ))}
        </div>
    );
}
