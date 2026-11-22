import React, { useEffect, useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { DistributorService } from '@/services/distribution/DistributorService';
import type { DistributorId } from '@/services/distribution/types/distributor';
import ConnectDistributorModal from '@/modules/distribution/components/ConnectDistributorModal';
import DistributorCredentialsPanel from '@/modules/distribution/components/DistributorCredentialsPanel';
import { logger } from '@/utils/logger';
import { cn } from '@/lib/utils';

/**
 * ISSUE-1703: one compact row of distributor connections for Publishing.
 * The full card grid stays in Distribution (DistributorConnectionsPanel);
 * here each distributor is a chip with its real connection state and a
 * Connect action, and the setup guides open in place.
 */
export function DistributorStrip() {
    const { connections, loading, error, fetchDistributors } = useStore(
        useShallow(state => ({
            connections: state.distribution.connections,
            loading: state.distribution.loading,
            error: state.distribution.error,
            fetchDistributors: state.fetchDistributors,
        }))
    );
    const [connectingId, setConnectingId] = useState<string | null>(null);
    const [showGuides, setShowGuides] = useState(false);

    useEffect(() => {
        fetchDistributors();
    }, [fetchDistributors]);

    const handleConnect = async (id: DistributorId) => {
        const adapter = DistributorService.getAdapter(id);
        if (!adapter) {
            logger.error(`[DistributorStrip] Adapter not found for ${id}`);
            return;
        }
        setConnectingId(id);
        const connected = await ConnectDistributorModal.call({ adapter });
        setConnectingId(null);
        if (connected) fetchDistributors();
    };

    return (
        <section aria-labelledby="publishing-distributors-title" data-testid="publishing-distributor-strip" className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
                <h2 id="publishing-distributors-title" className="mr-1 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Distributors
                </h2>

                {loading && connections.length === 0 && (
                    <span className="text-xs text-gray-500">Checking connections…</span>
                )}
                {!loading && connections.length === 0 && !error && (
                    <span className="text-xs text-gray-500">No distributors available.</span>
                )}

                {connections.map(connection => {
                    const name = DistributorService.getAdapter(connection.distributorId)?.name ?? connection.distributorId;
                    const isConnecting = connectingId === connection.distributorId;
                    return (
                        <div
                            key={connection.distributorId}
                            data-testid={`publishing-distributor-${connection.distributorId}`}
                            className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 py-1 pl-2.5 pr-1"
                        >
                            <span
                                aria-hidden="true"
                                className={cn('h-1.5 w-1.5 rounded-full', connection.isConnected ? 'bg-dept-publishing' : 'bg-gray-600')}
                            />
                            <span className="text-xs font-medium text-gray-200">{name}</span>
                            {connection.isConnected ? (
                                <span className="px-1.5 text-[10px] font-bold uppercase tracking-wider text-dept-publishing">Connected</span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => handleConnect(connection.distributorId)}
                                    disabled={isConnecting}
                                    aria-label={`Connect ${name}`}
                                    className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/20 disabled:opacity-50"
                                >
                                    {isConnecting ? 'Connecting…' : 'Connect'}
                                </button>
                            )}
                        </div>
                    );
                })}

                <button
                    type="button"
                    data-testid="toggle-distributor-guides-btn"
                    onClick={() => setShowGuides(prev => !prev)}
                    aria-expanded={showGuides}
                    className="ml-auto text-[10px] font-bold uppercase tracking-wider text-gray-500 transition-colors hover:text-white"
                >
                    {showGuides ? 'Hide setup guides' : 'Setup guides'}
                </button>
            </div>

            {error && (
                <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>
            )}

            {showGuides && (
                <div className="mt-3 border-t border-white/5 pt-3" data-testid="distro-guides-container">
                    <DistributorCredentialsPanel />
                </div>
            )}
        </section>
    );
}
