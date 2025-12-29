import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Music,
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    Share2,
    Edit, // Corrected import
    Trash2,
    CheckCircle2,
    AlertCircle,
    BarChart3,
    Clock,
    CheckSquare,
    Square,
    Globe, // Added missing imports
    DollarSign,
    Book,
    ExternalLink,
    Loader2
} from 'lucide-react';
import { useStore } from '@/core/store';
import { useReleases } from './hooks/useReleases';
import ReleaseWizard from './components/ReleaseWizard'; // Default import
import { PublishingSkeleton } from './components/PublishingSkeleton';
import { useToast } from '@/core/context/ToastContext';

// Simple CSS-based Sparkline Component for Beta Visualization
const Sparkline = ({ data, color = "text-green-500" }: { data: number[], color?: string }) => {
    return (
        <div className="flex items-end gap-1 h-8 w-24">
            {data.map((h, i) => (
                <div
                    key={i}
                    className={`w-1 rounded-t-sm bg-current ${color} opacity-80`}
                    style={{ height: `${Math.max(10, h)}%` }}
                />
            ))}
        </div>
    );
};

export default function PublishingDashboard() {
    // Beta Performance Mandate: Granular Selectors
    const setModule = useStore(state => state.setModule);
    const { finance, distribution, fetchDistributors, fetchEarnings, currentOrganizationId } = useStore();
    const toast = useToast();

    // Core State
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Data Hooks
    const { releases, loading: releasesLoading, deleteRelease } = useReleases(currentOrganizationId);

    // Initial Data Fetch
    useEffect(() => {
        if (currentOrganizationId) {
            fetchDistributors();
            // Fetch earnings for the last 30 days
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            fetchEarnings({ startDate, endDate });
        }
    }, [currentOrganizationId, fetchDistributors, fetchEarnings]);

    // Stats Calculation (Memoized)
    const stats = useMemo(() => {
        const total = releases.length;
        const live = releases.filter(r => r.status === 'live' || r.status === 'distributed').length;
        const draft = releases.filter(r => r.status === 'draft').length;
        const pending = releases.filter(r => ['pending_review', 'metadata_complete', 'assets_uploaded'].includes(r.status)).length;

        return {
            total,
            live,
            draft,
            pending,
            earningsTrend: [20, 35, 45, 30, 60, 75, 55, 80] // Mock data for sparkline
        };
    }, [releases]);

    // Filtering & Sorting (Memoized)
    const filteredReleases = useMemo(() => {
        return releases.filter(release => {
            const matchesSearch =
                release.metadata.trackTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                release.metadata.artistName?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesFilter = filterStatus === 'all' || release.status === filterStatus;

            return matchesSearch && matchesFilter;
        });
    }, [releases, searchQuery, filterStatus]);

    // Bulk Actions Handlers
    const toggleSelection = useCallback((id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            const stats = React.useMemo(() => [
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
            ], [releases, finance.earningsSummary]);

            return (
                <ErrorBoundary>
                    <div className="min-h-screen bg-[#0A0A0A] text-white">
                        <div className="max-w-7xl mx-auto px-6 py-12">
                            {/* Header */}
                            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h1 className="text-5xl font-black tracking-tighter uppercase italic">
                                            Publishing
                                        </h1>
                                        <div className="flex items-center gap-2 px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
                                            <Book size={12} className="text-blue-500" />
                                            <span className="text-[10px] font-bold text-blue-500 tracking-widest uppercase">Beta</span>
                                        </div>
                                    </div>
                                    <p className="text-gray-500 max-w-xl font-medium">
                                        Manage song rights, distribution, and global royalties.
                                    </p>
                                </div>

                                <button
                                    onClick={() => setShowReleaseWizard(true)}
                                    className="group flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl hover:bg-gray-200 transition-all font-bold tracking-tight active:scale-[0.98] shadow-lg hover:shadow-xl"
                                >
                                    <Plus size={18} className="transition-transform group-hover:rotate-90" />
                                    New Release
                                </button>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                                {stats.map((stat, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="relative overflow-hidden bg-[#121212] border border-gray-800/50 rounded-2xl p-6 shadow-xl group hover:border-gray-700/50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between mb-4">
                                            <div className={`p-3 bg-${stat.color}-500/10 rounded-xl group-hover:bg-${stat.color}-500/20 transition-colors`}>
                                                <stat.icon size={20} className={`text-${stat.color}-400`} />
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
                                            <p className="text-4xl font-black text-white mb-1 tracking-tighter">{stat.value}</p>
                                            <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">{stat.label}</span>
                                        </div>
                                        {/* Decorative gradient */}
                                        <div className={`absolute top-0 right-0 w-32 h-32 bg-${stat.color}-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-${stat.color}-500/10 transition-all`} />
                                    </motion.div>
                                ))}
                            </div>

                            {/* Main Content Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Releases List */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <h3 className="text-2xl font-bold text-white tracking-tight">Your Catalog</h3>
                                        <div className="flex items-center gap-2 w-full sm:w-auto">
                                            <div className="relative flex-1 sm:w-64">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                                <input
                                                    type="text"
                                                    placeholder="Search releases..."
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-2.5 bg-[#161616] border border-gray-800 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-700 focus:ring-1 focus:ring-gray-700 transition-all"
                                                />
                                            </div>
                                            <div className="relative">
                                                <select
                                                    value={filterStatus}
                                                    onChange={(e) => setFilterStatus(e.target.value)}
                                                    className="appearance-none pl-4 pr-10 py-2.5 bg-[#161616] border border-gray-800 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-gray-700 transition-all cursor-pointer font-medium"
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
                                        <div className="flex items-center justify-center py-20 bg-[#121212] border border-gray-800/50 rounded-2xl">
                                            <Loader2 size={32} className="text-gray-500 animate-spin" />
                                        </div>
                                    ) : filteredReleases.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-24 text-center bg-[#121212] border border-gray-800/50 rounded-2xl border-dashed">
                                            <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mb-4">
                                                <Music size={24} className="text-gray-700" />
                                            </div>
                                            <h4 className="text-lg font-bold text-white mb-2">
                                                {searchQuery ? "No matching releases" : "Build your discography"}
                                            </h4>
                                            <p className="text-gray-500 text-sm mb-6 max-w-sm">
                                                {searchQuery
                                                    ? `We couldn't find anything matching "${searchQuery}".`
                                                    : "Your first step to global distribution starts here."}
                                            </p>
                                            {!searchQuery && (
                                                <button
                                                    onClick={() => setShowReleaseWizard(true)}
                                                    className="px-5 py-2 bg-gray-900 text-white border border-gray-800 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                                                >
                                                    Create First Release
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <motion.div className="space-y-4" layout>
                                            <AnimatePresence mode="popLayout">
                                                {filteredReleases.map((release) => (
                                                    <motion.div
                                                        key={release.id}
                                                        layout
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.98 }}
                                                        className="group relative flex items-center justify-between p-4 bg-[#121212] hover:bg-[#161616] rounded-xl border border-gray-800/50 hover:border-gray-700 transition-all duration-200 cursor-pointer"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="relative w-14 h-14 bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
                                                                {release.assets.coverArtUrl ? (
                                                                    <img src={release.assets.coverArtUrl} alt={release.metadata.trackTitle} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <Music size={20} className="text-gray-600" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-base text-white group-hover:text-blue-400 transition-colors mb-0.5">
                                                                    {release.metadata.trackTitle}
                                                                </h4>
                                                                <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                                                                    <span>{release.metadata.artistName}</span>
                                                                    <span className="w-0.5 h-0.5 rounded-full bg-gray-600" />
                                                                    <span>{release.metadata.releaseType}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-6">
                                                            <div className="text-right hidden sm:block">
                                                                <div className="flex items-center justify-end gap-1.5 px-2 py-1 bg-gray-900 rounded border border-gray-800">
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${(release.status as string) === 'live' ? 'bg-green-500' :
                                                                        ['metadata_complete', 'assets_uploaded', 'validating', 'pending_review', 'approved', 'delivering'].includes(release.status) ? 'bg-blue-500' :
                                                                            'bg-gray-500'
                                                                        }`} />
                                                                    <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">
                                                                        {release.status.replace('_', ' ')}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <button className="p-2 text-gray-600 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                                                                    <Edit2 size={16} />
                                                                </button>
                                                                <button className="p-2 text-gray-600 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
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
                                    <div className="bg-[#121212] border border-gray-800/50 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                                        <h3 className="text-lg font-bold text-white mb-6 flex items-center justify-between tracking-tight">
                                            Distribution
                                            <Globe size={16} className="text-gray-600" />
                                        </h3>
                                        {distribution.loading ? (
                                            <div className="flex items-center justify-center py-6">
                                                <Loader2 size={24} className="text-blue-500 animate-spin" />
                                            </div>
                                        ) : distribution.connections.length === 0 ? (
                                            <div className="text-center py-8 bg-gray-900/30 rounded-xl border border-dashed border-gray-800">
                                                <AlertCircle size={24} className="text-gray-700 mx-auto mb-3" />
                                                <p className="text-gray-400 text-sm font-medium">No connectors active</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {distribution.connections.map((conn) => (
                                                    <div key={conn.distributorId} className="flex items-center justify-between p-3 bg-gray-900/40 hover:bg-gray-900/60 rounded-xl border border-gray-800/50 transition-colors group">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-2 h-2 rounded-full ${conn.isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.3)]' : 'bg-gray-600'}`} />
                                                            <span className={`text-sm font-medium ${conn.isConnected ? "text-gray-300" : "text-gray-600"}`}>
                                                                {conn.distributorId.charAt(0).toUpperCase() + conn.distributorId.slice(1)}
                                                            </span>
                                                        </div>
                                                        <ExternalLink size={14} className="text-gray-700 group-hover:text-white transition-colors" />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <button
                                            onClick={() => setModule('distribution')}
                                            className="w-full mt-6 px-4 py-3 bg-[#161616] text-white border border-gray-800 rounded-xl hover:bg-gray-800 transition-all text-xs font-bold uppercase tracking-widest active:scale-[0.98]"
                                        >
                                            Manage Connections
                                        </button>
                                    </div>

                                    {/* Royalties */}
                                    <div className="bg-[#121212] border border-gray-800/50 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                                        <h3 className="text-lg font-bold text-white mb-1 tracking-tight">Royalties</h3>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-6">Estimated Income</p>

                                        {finance.loading ? (
                                            <div className="flex items-center justify-center py-6">
                                                <Loader2 size={24} className="text-purple-500 animate-spin" />
                                            </div>
                                        ) : finance.earningsSummary ? (
                                            <>
                                                <div className="flex items-baseline gap-1 mb-8">
                                                    <span className="text-2xl font-bold text-purple-500">$</span>
                                                    <span className="text-5xl font-black text-white tracking-tighter">
                                                        {finance.earningsSummary.totalNetRevenue.toFixed(2)}
                                                    </span>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between p-3 bg-gray-900/40 rounded-xl border border-gray-800/50">
                                                        <div className="flex items-center gap-2">
                                                            <Globe size={14} className="text-green-500" />
                                                            <span className="text-sm text-gray-400 font-medium">Streams</span>
                                                        </div>
                                                        <span className="text-sm font-bold text-white">{finance.earningsSummary.totalStreams.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                                <button className="w-full mt-6 py-3 bg-white text-black rounded-xl font-bold text-sm hover:bg-gray-200 transition-all active:scale-[0.98]">
                                                    Withdraw Funds
                                                </button>
                                            </>
                                        ) : (
                                            <div className="text-center py-6">
                                                <p className="text-gray-500 text-sm">No revenue data available</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Release Wizard Modal */}
                            {showReleaseWizard && (
                                <ReleaseWizard
                                    onClose={() => setShowReleaseWizard(false)}
                                    onComplete={(releaseId) => {
                                        setShowReleaseWizard(false);
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </ErrorBoundary>
            );
        }
