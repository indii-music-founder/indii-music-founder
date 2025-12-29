/**
 * Publishing Dashboard
 * Manage music distribution, releases, and royalties
 */

import React, { useState, useEffect } from 'react';
import { Book, Plus, Music, DollarSign, Globe, Clock, CheckCircle, AlertCircle, Loader2, Search, Filter, MoreVertical, ExternalLink, Edit2, Share2 } from 'lucide-react';
import ReleaseWizard from './components/ReleaseWizard';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { useStore } from '@/core/store';
import { useReleases } from './hooks/useReleases';
import { motion, AnimatePresence } from 'framer-motion';

export default function PublishingDashboard() {
    const [showReleaseWizard, setShowReleaseWizard] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    const { currentOrganizationId, finance, distribution, fetchDistributors, fetchEarnings, setModule } = useStore();
    const { releases, loading: releasesLoading } = useReleases(currentOrganizationId);

    const filteredReleases = releases.filter(release => {
        const matchesSearch = release.metadata.trackTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
            release.metadata.artistName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterStatus === 'all' || release.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {stats.map((stat, index) => (
                        <motion.div
                            key={index}
                            whileHover={{ y: -4 }}
                            className="relative overflow-hidden bg-[#161b22]/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 shadow-xl group"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-3 bg-${stat.color}-500/10 rounded-xl group-hover:bg-${stat.color}-500/20 transition-colors`}>
                                    <stat.icon size={24} className={`text-${stat.color}-400`} />
                                </div>
                                <div className="h-8 w-24 bg-gray-800/30 rounded-lg overflow-hidden flex items-end gap-0.5 p-1">
                                    {[1, 2, 3, 4, 5, 6].map(i => (
                                        <div
                                            key={i}
                                            className={`flex-1 bg-${stat.color}-500/30 rounded-t-sm`}
                                            style={{ height: `${Math.random() * 100}%` }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="relative">
                                <p className="text-3xl font-black text-white mb-1 tracking-tight">{stat.value}</p>
                                <span className="text-gray-500 text-sm font-medium uppercase tracking-wider">{stat.label}</span>
                            </div>
                            {/* Decorative gradient */}
                            <div className={`absolute top-0 right-0 w-32 h-32 bg-${stat.color}-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-${stat.color}-500/10 transition-all`} />
                        </motion.div>
                    ))}
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Releases List */}
                    <div className="lg:col-span-2 bg-[#161b22]/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 shadow-2xl">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                            <div>
                                <h3 className="text-xl font-bold text-white mb-1">Your Catalog</h3>
                                <p className="text-sm text-gray-500">
                                    {filteredReleases.length} release{filteredReleases.length !== 1 ? 's' : ''} found
                                </p>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <div className="relative flex-1 sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search catalog..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-700/50 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                                    />
                                </div>
                                <div className="relative">
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        className="appearance-none pl-4 pr-10 py-2 bg-gray-900/50 border border-gray-700/50 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-blue-500/50 transition-all cursor-pointer"
                                    >
                                        <option value="all">All Status</option>
                                        <option value="live">Live</option>
                                        <option value="draft">Draft</option>
                                        <option value="pending_review">Pending</option>
                                        <option value="metadata_complete">Processing</option>
                                    </select>
                                    <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
                                </div>
                            </div>
                        </div>

                        {releasesLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 size={32} className="text-gray-500 animate-spin" />
                            </div>
                        ) : filteredReleases.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="w-20 h-20 bg-gray-900/50 rounded-3xl flex items-center justify-center mb-6 border border-gray-800/50 shadow-inner">
                                    <Music size={32} className="text-gray-700" />
                                </div>
                                <h4 className="text-xl font-semibold text-white mb-2">
                                    {searchQuery ? "No matching releases" : "Build your discography"}
                                </h4>
                                <p className="text-gray-500 text-sm mb-8 max-w-sm leading-relaxed">
                                    {searchQuery
                                        ? `We couldn't find anything matching "${searchQuery}". Try a different search term or clear filters.`
                                        : "Your first step to global distribution starts here. Upload your tracks and we'll handle the rest."}
                                </p>
                                {!searchQuery && (
                                    <button
                                        onClick={() => setShowReleaseWizard(true)}
                                        className="flex items-center gap-2 px-6 py-3 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-xl hover:bg-blue-500/20 transition-all font-medium"
                                    >
                                        <Plus size={18} />
                                        Create New Release
                                    </button>
                                )}
                            </div>
                        ) : (
                            <motion.div
                                className="space-y-4"
                                layout
                            >
                                <AnimatePresence mode="popLayout">
                                    {filteredReleases.map((release) => (
                                        <motion.div
                                            key={release.id}
                                            layout
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="group relative flex items-center justify-between p-5 bg-gray-900/30 hover:bg-gray-800/40 rounded-2xl border border-gray-800/50 hover:border-blue-500/30 transition-all duration-300 pointer-events-auto cursor-pointer shadow-lg hover:shadow-blue-500/5"
                                        >
                                            <div className="flex items-center gap-5">
                                                <div className="relative w-16 h-16 bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center border border-gray-700/50 shadow-2xl group-hover:scale-105 transition-transform duration-500">
                                                    {release.assets.coverArtUrl ? (
                                                        <img src={release.assets.coverArtUrl} alt={release.metadata.trackTitle} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Music size={24} className="text-gray-600" />
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors mb-1">
                                                        {release.metadata.trackTitle}
                                                    </h4>
                                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                                        <span>{release.metadata.artistName}</span>
                                                        <span className="w-1 h-1 rounded-full bg-gray-600" />
                                                        <span className="text-gray-500">{release.metadata.releaseType}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-8">
                                                <div className="text-right hidden sm:block">
                                                    <p className="text-sm font-medium text-gray-300 mb-1">
                                                        {new Date(release.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </p>
                                                    <div className="flex items-center justify-end gap-2 px-2 py-0.5 bg-gray-800/50 rounded-lg border border-gray-700/50">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${(release.status as string) === 'live' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
                                                            ['metadata_complete', 'assets_uploaded', 'validating', 'pending_review', 'approved', 'delivering'].includes(release.status) ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' :
                                                                'bg-gray-500'
                                                            }`} />
                                                        <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 whitespace-nowrap">
                                                            {release.status.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button className="p-2 text-gray-500 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button className="p-2 text-gray-500 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors">
                                                        <Share2 size={16} />
                                                    </button>
                                                    <button className="p-2 text-gray-500 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors">
                                                        <MoreVertical size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </div>


                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Distribution Status */}
                        <div className="bg-[#161b22]/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center justify-between">
                                Distribution
                                <Globe size={16} className="text-gray-500" />
                            </h3>
                            {distribution.loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 size={24} className="text-blue-500 animate-spin" />
                                </div>
                            ) : distribution.connections.length === 0 ? (
                                <div className="text-center py-8 bg-gray-900/40 rounded-xl border border-dashed border-gray-800">
                                    <AlertCircle size={32} className="text-gray-700 mx-auto mb-3" />
                                    <p className="text-gray-400 text-sm font-medium mb-1">No connections</p>
                                    <p className="text-gray-600 text-xs px-4">Connect to start distributing.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {distribution.connections.map((conn) => (
                                        <div key={conn.distributorId} className="flex items-center justify-between p-4 bg-gray-900/40 hover:bg-gray-900/60 rounded-xl border border-gray-800/50 transition-colors group/item">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${conn.isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-600'}`} />
                                                <span className={`font-medium ${conn.isConnected ? "text-gray-200" : "text-gray-500"}`}>
                                                    {conn.distributorId.charAt(0).toUpperCase() + conn.distributorId.slice(1)}
                                                </span>
                                            </div>
                                            <ExternalLink size={14} className="text-gray-600 group-hover/item:text-blue-400 transition-colors" />
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button
                                onClick={() => setModule('distribution')}
                                className="w-full mt-6 px-4 py-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl hover:bg-blue-500/20 transition-all text-sm font-bold active:scale-[0.98]"
                            >
                                Connect Distributor
                            </button>
                        </div>

                        {/* Royalties Summary */}
                        <div className="bg-[#161b22]/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-0 shadow-2xl overflow-hidden group">
                            <div className="p-6 pb-0">
                                <h3 className="text-lg font-bold text-white mb-1">Royalties</h3>
                                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Estimated Earnings</p>
                            </div>

                            {finance.loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={24} className="text-purple-500 animate-spin" />
                                </div>
                            ) : finance.earningsSummary ? (
                                <div className="p-6">
                                    <div className="flex items-baseline gap-1 mb-8">
                                        <span className="text-xl font-bold text-purple-400">$</span>
                                        <span className="text-5xl font-black text-white tracking-tighter">
                                            {finance.earningsSummary.totalNetRevenue.toFixed(2)}
                                        </span>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-3 bg-gray-900/40 rounded-xl border border-gray-800/50">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-green-500/10 rounded-lg">
                                                    <Globe size={14} className="text-green-400" />
                                                </div>
                                                <span className="text-sm text-gray-400">Total Streams</span>
                                            </div>
                                            <span className="text-sm font-bold text-white">{finance.earningsSummary.totalStreams.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-gray-900/40 rounded-xl border border-gray-800/50">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-blue-500/10 rounded-lg">
                                                    <DollarSign size={14} className="text-blue-400" />
                                                </div>
                                                <span className="text-sm text-gray-400">Next Payout</span>
                                            </div>
                                            <span className="text-sm font-bold text-gray-500">Scheduled</span>
                                        </div>
                                    </div>
                                    <button className="w-full mt-6 py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-[0.98]">
                                        Withdraw Funds
                                    </button>
                                </div>
                            ) : (
                                <div className="p-12 text-center">
                                    <div className="w-16 h-16 bg-gray-900/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-800/50">
                                        <DollarSign size={24} className="text-gray-700" />
                                    </div>
                                    <p className="text-gray-400 text-sm font-medium">No revenue to show</p>
                                </div>
                            )}
                            {/* Decorative background circle */}
                            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-purple-500/5 blur-3xl rounded-full pointer-events-none" />
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden group">
                            <div className="relative z-10">
                                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                                    Go Premium
                                    <CheckCircle size={16} className="text-blue-200" />
                                </h3>
                                <p className="text-blue-100 text-xs mb-6 leading-relaxed">Unlock advanced analytics, AI mastering, and priority distribution to 150+ stores.</p>
                                <button className="w-full py-3 bg-white text-blue-600 rounded-xl font-bold text-sm hover:bg-gray-100 transition-all shadow-lg active:scale-[0.98]">
                                    Upgrade Now
                                </button>
                            </div>
                            {/* Abstract decorative elements */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-2xl rounded-full -mr-16 -mt-16 group-hover:bg-white/20 transition-all" />
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 blur-xl rounded-full -ml-12 -mb-12" />
                        </div>

                        <div className="bg-[#161b22]/40 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 shadow-2xl">
                            <h3 className="text-lg font-bold text-white mb-4">Resources</h3>
                            <div className="space-y-2">
                                <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/40 hover:bg-gray-900/60 rounded-xl text-gray-400 hover:text-white border border-gray-800/50 transition-all group/res">
                                    <div className="flex items-center gap-3">
                                        <Book size={18} className="text-purple-400" />
                                        <span className="text-sm">Distribution Guide</span>
                                    </div>
                                    <ExternalLink size={14} className="opacity-0 group-hover/res:opacity-100 transition-opacity" />
                                </button>
                                <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/40 hover:bg-gray-900/60 rounded-xl text-gray-400 hover:text-white border border-gray-800/50 transition-all group/res">
                                    <div className="flex items-center gap-3">
                                        <Globe size={18} className="text-blue-400" />
                                        <span className="text-sm">Artist Help Center</span>
                                    </div>
                                    <ExternalLink size={14} className="opacity-0 group-hover/res:opacity-100 transition-opacity" />
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
