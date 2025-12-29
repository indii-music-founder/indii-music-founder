/**
 * Publishing Dashboard
 * Manage music distribution, releases, and royalties
 */

import React, { useState, useEffect } from 'react';
import { Book, Plus, Music, DollarSign, Globe, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import ReleaseWizard from './components/ReleaseWizard';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { useStore } from '@/core/store';
import { useReleases } from './hooks/useReleases';


export default function PublishingDashboard() {
    const [showReleaseWizard, setShowReleaseWizard] = useState(false);

    const { currentOrganizationId, finance, distribution, fetchDistributors, fetchEarnings, setModule } = useStore();
    const { releases, loading: releasesLoading } = useReleases(currentOrganizationId);

    // Initial data fetch
    useEffect(() => {
        if (currentOrganizationId) {
            fetchDistributors();
            // Fetch earnings for the last 30 days
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            fetchEarnings({ startDate, endDate });
        }
    }, [currentOrganizationId, fetchDistributors, fetchEarnings]);
    const stats = [
        {
            label: 'Total Releases',
            value: releases.length.toString(),
            icon: Music,
            color: 'blue'
        },
        {
            label: 'Live on DSPs',
            value: releases.filter(r => (r.status as string) === 'live').length.toString(),
            icon: Globe,
            color: 'green'
        },
        {
            label: 'Pending Review',
            value: releases.filter(r => [
                'metadata_complete',
                'assets_uploaded',
                'validating',
                'pending_review',
                'approved',
                'delivering'
            ].includes(r.status)).length.toString(),
            icon: Clock,
            color: 'yellow'
        },
        {
            label: 'Total Earnings',
            value: finance.earningsSummary ? `$${finance.earningsSummary.totalNetRevenue.toFixed(2)}` : '$0.00',
            icon: DollarSign,
            color: 'purple'
        }
    ];


    return (

        <ErrorBoundary>
            <div className="p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                            <Book size={32} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Publishing Department</h1>
                            <p className="text-gray-400">Manage song rights, distribution, and royalties</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowReleaseWizard(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        <Plus size={18} />
                        New Release
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {stats.map((stat, index) => (
                        <div
                            key={index}
                            className="bg-[#161b22] border border-gray-800 rounded-xl p-4"
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`p-2 bg-${stat.color}-500/10 rounded-lg`}>
                                    <stat.icon size={20} className={`text-${stat.color}-400`} />
                                </div>
                                <span className="text-gray-400 text-sm">{stat.label}</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Releases List */}
                    <div className="lg:col-span-2 bg-[#161b22] border border-gray-800 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-white">Your Releases</h3>
                        </div>

                        {releasesLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 size={32} className="text-gray-500 animate-spin" />
                            </div>
                        ) : releases.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                    <Music size={32} className="text-gray-600" />
                                </div>
                                <h4 className="text-lg font-medium text-white mb-2">No releases yet</h4>
                                <p className="text-gray-400 text-sm mb-4 max-w-sm">
                                    Create your first release to distribute your music to streaming platforms worldwide.
                                </p>
                                <button
                                    onClick={() => setShowReleaseWizard(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-colors"
                                >
                                    <Plus size={16} />
                                    Create First Release
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {releases.map((release) => (
                                    <div
                                        key={release.id}
                                        className="flex items-center justify-between p-4 bg-gray-800/30 rounded-xl border border-gray-700 hover:border-gray-600 transition-all group pointer-events-auto cursor-pointer"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
                                                {release.assets.coverArtUrl ? (
                                                    <img src={release.assets.coverArtUrl} alt={release.metadata.trackTitle} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Music size={20} className="text-gray-500" />
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-white group-hover:text-blue-400 transition-colors">
                                                    {release.metadata.trackTitle}
                                                </h4>
                                                <p className="text-sm text-gray-400">
                                                    {release.metadata.artistName} • {release.metadata.releaseType}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right hidden sm:block">
                                                <p className="text-sm text-gray-300">
                                                    {new Date(release.createdAt).toLocaleDateString()}
                                                </p>
                                                <p className="text-xs text-gray-500 capitalize">
                                                    {release.status.replace('_', ' ')}
                                                </p>
                                            </div>
                                            <div className={`
                                                px-3 py-1 rounded-full text-xs font-medium border
                                                ${(release.status as string) === 'live' ? 'bg-green-500/10 border-green-500/30 text-green-400' : ''}
                                                ${[
                                                    'metadata_complete',
                                                    'assets_uploaded',
                                                    'validating',
                                                    'pending_review',
                                                    'approved',
                                                    'delivering'
                                                ].includes(release.status) ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : ''}
                                                ${release.status === 'draft' ? 'bg-gray-500/10 border-gray-500/30 text-gray-400' : ''}
                                                ${release.status === 'taken_down' ? 'bg-red-500/10 border-red-500/30 text-red-400' : ''}
                                            `}>
                                                {(release.status as string) === 'live' ? 'Live' : release.status.replace('_', ' ')}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>


                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Distribution Status */}
                        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Distribution Status</h3>
                            {distribution.loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 size={24} className="text-gray-500 animate-spin" />
                                </div>
                            ) : distribution.connections.length === 0 ? (
                                <div className="text-center py-6">
                                    <AlertCircle size={32} className="text-gray-600 mx-auto mb-3" />
                                    <p className="text-gray-400 text-sm mb-2">No distributors connected</p>
                                    <p className="text-gray-500 text-xs">Connect your distributor accounts to start releasing music.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {distribution.connections.map((conn) => (
                                        <div key={conn.distributorId} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                {conn.isConnected ? (
                                                    <CheckCircle size={16} className="text-green-400" />
                                                ) : (
                                                    <AlertCircle size={16} className="text-gray-500" />
                                                )}
                                                <span className={conn.isConnected ? "text-gray-300 text-sm" : "text-gray-400 text-sm"}>
                                                    {conn.distributorId.charAt(0).toUpperCase() + conn.distributorId.slice(1)}
                                                </span>
                                            </div>
                                            <span className="text-xs text-gray-500">
                                                {conn.isConnected ? 'Connected' : 'Not connected'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button
                                onClick={() => setModule('distribution')}
                                className="w-full mt-4 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                            >
                                Connect Distributor
                            </button>
                        </div>

                        {/* Royalties Summary */}
                        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Royalties</h3>
                            {finance.loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 size={24} className="text-gray-500 animate-spin" />
                                </div>
                            ) : finance.earningsSummary ? (
                                <>
                                    <div className="text-center py-6">
                                        <p className="text-3xl font-bold text-white mb-1">
                                            ${finance.earningsSummary.totalNetRevenue.toFixed(2)}
                                        </p>
                                        <p className="text-gray-400 text-sm">Accrued this period</p>
                                    </div>
                                    <div className="border-t border-gray-800 pt-4 mt-4">
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-gray-400">Last payout</span>
                                            <span className="text-gray-300">--</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Total streams</span>
                                            <span className="text-gray-300">{finance.earningsSummary.totalStreams.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-6">
                                    <DollarSign size={32} className="text-gray-600 mx-auto mb-3" />
                                    <p className="text-gray-400 text-sm mb-1">No earnings data</p>
                                    <p className="text-gray-500 text-xs">Connect your distributors to sync royalty data.</p>
                                </div>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                            <div className="space-y-2">
                                <button className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800/50 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors text-left">
                                    <Globe size={18} className="text-blue-400" />
                                    <span>View DSP Analytics</span>
                                </button>
                                <button className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800/50 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors text-left">
                                    <DollarSign size={18} className="text-green-400" />
                                    <span>Request Payout</span>
                                </button>
                                <button className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800/50 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors text-left">
                                    <Book size={18} className="text-purple-400" />
                                    <span>Manage Catalog</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Release Wizard Modal */}
                {showReleaseWizard && (
                    <ReleaseWizard
                        onClose={() => setShowReleaseWizard(false)}
                        onComplete={(releaseId) => {
                            console.log('Release created:', releaseId);
                            setShowReleaseWizard(false);
                            // hook updates automatically via onSnapshot
                        }}
                    />
                )}
            </div>
        </ErrorBoundary>
    );
}
