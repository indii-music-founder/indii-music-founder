import React, { useEffect, useState } from 'react';
import { Key, KeyRound } from 'lucide-react';
import { credentialService } from '@/services/security/CredentialService';
import type { DistributorId } from '@/services/distribution/types/distributor';

const KNOWN_DISTRIBUTORS: DistributorId[] = [
    'merlin', 'spotify', 'apple', 'amazon', 'tidal', 'deezer',
    'distrokid', 'tunecore', 'cdbaby', 'ditto', 'awal', 'unitedmasters', 'amuse', 'symphonic', 'onerpm', 'believe',
];

const POLL_INTERVAL_MS = 5000;

const displayName = (id: DistributorId): string => id.charAt(0).toUpperCase() + id.slice(1);

export function ApiCredentialsPane() {
    const [configured, setConfigured] = useState<Set<string> | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const refresh = async () => {
            try {
                const ids = await credentialService.listConfigured();
                if (!cancelled) {
                    setConfigured(new Set(ids));
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load credential status');
                }
            }
        };
        refresh();
        const interval = setInterval(refresh, POLL_INTERVAL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    if (error) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <Key size={32} className="mb-3 opacity-20" />
                <span className="font-bold uppercase tracking-widest text-[10px] text-red-400">{error}</span>
            </div>
        );
    }

    if (!configured) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                <span className="animate-pulse">Loading credential vault...</span>
            </div>
        );
    }

    const configuredCount = KNOWN_DISTRIBUTORS.filter((id) => configured.has(id)).length;

    return (
        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-lg flex items-center gap-3 text-[10px] text-gray-400">
                <KeyRound size={16} className="text-amber-400" />
                <span>
                    Configured: <span className="text-white font-medium">{configuredCount}</span> / {KNOWN_DISTRIBUTORS.length}
                </span>
            </div>
            {KNOWN_DISTRIBUTORS.map((id) => {
                const isConfigured = configured.has(id);
                return (
                    <div key={id} className="p-3 bg-white/[0.02] border border-white/5 rounded-lg flex items-center gap-3">
                        <Key size={14} className={isConfigured ? 'text-emerald-400' : 'text-gray-600'} />
                        <span className="text-xs text-white truncate">{displayName(id)}</span>
                        <span className={`ml-auto text-[10px] ${isConfigured ? 'text-emerald-400' : 'text-gray-500'}`}>
                            {isConfigured ? 'configured' : 'not configured'}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
