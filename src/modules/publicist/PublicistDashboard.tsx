import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mic,
    Plus,
    Search,
    MoreVertical,
    Users,
    Megaphone,
    ArrowUpRight,
    LayoutGrid,
    List,
    Loader2,
    Sparkles
} from 'lucide-react';
import { usePublicist } from './hooks/usePublicist';
import { CampaignCard } from './components/CampaignCard';
import { ContactList } from './components/ContactList';
import { StatsTicker } from './components/StatsTicker';
import { CreateCampaignModal } from './components/CreateCampaignModal';
import { CampaignDetailsModal } from './components/CampaignDetailsModal';
import { ContactDetailsModal } from './components/ContactDetailsModal';
import { ProTipsModal } from './components/ProTipsModal';
import { OnboardingModal } from '../onboarding/OnboardingModal';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';
import { Campaign, Contact } from './types';

export default function PublicistDashboard() {
    const {
        campaigns,
        contacts,
        stats,
        searchQuery,
        setSearchQuery,
        filterType,
        setFilterType,
        activeTab,
        setActiveTab,
        loading,
        userProfile
    } = usePublicist();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [isTipsOpen, setIsTipsOpen] = useState(false);
    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-950">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-sonic-purple" />
                    <p className="text-slate-400 font-medium animate-pulse">Loading Publicist Data...</p>
                </div>
            </div>
        );
    }

    return (
        <ModuleErrorBoundary moduleName="Publicist Dashboard">
            <div className="min-h-screen bg-slate-950 text-white p-6 lg:p-10 relative overflow-hidden font-sans">
                {/* Background Decor */}
                <div className="fixed -top-[20%] -left-[10%] w-[50%] h-[50%] bg-sonic-purple/10 blur-[150px] pointer-events-none" />
                <div className="fixed bottom-[10%] right-[5%] w-[30%] h-[30%] bg-sonic-blue/10 blur-[150px] pointer-events-none" />

                <div className="max-w-[1600px] mx-auto relative z-10">
                    {/* Header Section */}
                    <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 mb-12">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-gradient-to-br from-sonic-purple/20 to-sonic-blue/20 border border-white/10 rounded-2xl shadow-xl backdrop-blur-md">
                                    <Mic size={32} className="text-white drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
                                </div>
                                <div>
                                    <h1 className="text-5xl font-black tracking-tighter text-white mb-1">
                                        Publicist
                                        <span className="text-sonic-purple">.</span>
                                    </h1>
                                    <p className="text-slate-400 font-medium tracking-wide text-sm uppercase">
                                        Global Press & Media Relations
                                    </p>
                                </div>
                            </div>
                            <StatsTicker stats={stats} />
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sonic-purple transition-colors" size={18} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search campaigns & contacts..."
                                    className="w-full md:w-80 bg-white/5 backdrop-blur-md border border-white/10 focus:border-sonic-purple/50 rounded-2xl py-3 pl-12 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-sonic-purple/10 transition-all shadow-lg"
                                />
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                                <Plus size={20} />
                                <span className="hidden sm:inline">New Campaign</span>
                            </button>
                        </div>
                    </div>

                    {/* Main Content Layout (3-Column) */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                        {/* LEFT COLUMN: Navigation & Quick Actions (2 cols) */}
                        <div className="xl:col-span-2 space-y-4 hidden xl:block">
                            <div className="glass-panel rounded-3xl p-4 space-y-2 bg-slate-900/50 border-white/5">
                                <button className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 text-white rounded-xl font-bold border border-white/10 shadow-lg">
                                    <Megaphone size={18} className="text-sonic-purple" />
                                    Campaigns
                                </button>
                                <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl font-medium transition-all">
                                    <Users size={18} />
                                    Contacts
                                </button>
                                <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl font-medium transition-all">
                                    <ArrowUpRight size={18} />
                                    Reports
                                </button>
                                <button
                                    onClick={() => setIsOnboardingOpen(true)}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl font-medium transition-all"
                                >
                                    <Sparkles size={18} />
                                    Brand Identity
                                </button>
                            </div>

                            <div
                                onClick={() => setIsTipsOpen(true)}
                                className="p-6 bg-gradient-to-br from-sonic-purple/20 to-sonic-blue/20 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-sonic-purple/30 transition-colors cursor-pointer"
                            >
                                <h3 className="text-xl font-bold text-white mb-2 relative z-10">Pro Tips</h3>
                                <p className="text-sm text-slate-300 relative z-10 mb-4">Enhance your pitch with AI-generated press kits.</p>
                                <div className="absolute bottom-0 right-0 w-32 h-32 bg-sonic-purple/30 blur-3xl rounded-full group-hover:bg-sonic-purple/40 transition-all" />
                            </div>
                        </div>

                        {/* CENTER COLUMN: Active Workspace (7 cols) */}
                        <div className="xl:col-span-7 space-y-6">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-2xl font-bold text-white tracking-tight">Active Campaigns</h2>
                                <div className="flex items-center gap-4">
                                    <select
                                        value={filterType}
                                        onChange={(e) => setFilterType(e.target.value as 'all' | 'Live' | 'Scheduled' | 'Draft')}
                                        className="bg-white/5 px-3 py-2 rounded-xl border border-white/10 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-sonic-purple/20 transition-all"
                                    >
                                        <option value="all" className="bg-slate-900">All Status</option>
                                        <option value="Live" className="bg-slate-900">Live</option>
                                        <option value="Scheduled" className="bg-slate-900">Scheduled</option>
                                        <option value="Draft" className="bg-slate-900">Draft</option>
                                    </select>
                                    <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                                        <button
                                            onClick={() => setViewMode('grid')}
                                            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            <LayoutGrid size={16} />
                                        </button>
                                        <button
                                            onClick={() => setViewMode('list')}
                                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            <List size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                                <AnimatePresence mode="popLayout">
                                    {campaigns.map((campaign) => (
                                        <CampaignCard
                                            key={campaign.id}
                                            campaign={campaign}
                                            onClick={(c) => setSelectedCampaign(c)}
                                        />
                                    ))}
                                </AnimatePresence>

                                {campaigns.length === 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="col-span-full py-12 flex flex-col items-center justify-center text-center space-y-4"
                                    >
                                        <div className="p-4 bg-slate-800/50 rounded-full">
                                            <Megaphone size={40} className="text-slate-500 opacity-50" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">No Campaigns Found</h3>
                                            <p className="text-sm text-slate-400">Adjust your search or filter to see more.</p>
                                        </div>
                                    </motion.div>
                                )}

                                {/* "Add New" Placeholder Card */}
                                <motion.button
                                    onClick={() => setIsCreateModalOpen(true)}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="flex flex-col items-center justify-center gap-4 p-8 border-2 border-dashed border-white/5 rounded-2xl hover:border-white/20 hover:bg-white/5 transition-all group min-h-[160px]"
                                >
                                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                                        <Plus size={24} className="text-slate-500 group-hover:text-white" />
                                    </div>
                                    <span className="text-sm font-bold text-slate-500 group-hover:text-white">Start New Campaign</span>
                                </motion.button>
                            </div>
                        </div>

                        {/* RIGHT COLUMN: Contact Stream / Feed (3 cols) */}
                        <div className="xl:col-span-3 space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold text-white tracking-tight">Media Network</h2>
                                <button className="text-xs font-bold text-purple-400 hover:text-purple-300 uppercase tracking-wide">View All</button>
                            </div>

                            <div className="bg-slate-900/40 rounded-3xl p-4 border border-white/5 h-[calc(100vh-320px)] overflow-y-auto no-scrollbar relative">
                                {contacts.length > 0 ? (
                                    <ContactList
                                        contacts={contacts}
                                        onSelectContact={(c) => setSelectedContact(c)}
                                    />
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                                        <Users size={32} className="text-slate-600 opacity-30" />
                                        <p className="text-sm text-slate-500">No media contacts found matching your query.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <CreateCampaignModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                userId={userProfile?.uid || ''}
            />
            <CampaignDetailsModal
                isOpen={!!selectedCampaign}
                onClose={() => setSelectedCampaign(null)}
                campaign={selectedCampaign}
                userId={userProfile?.uid || ''}
            />
            <ContactDetailsModal
                isOpen={!!selectedContact}
                onClose={() => setSelectedContact(null)}
                contact={selectedContact}
            />
            <ProTipsModal
                isOpen={isTipsOpen}
                onClose={() => setIsTipsOpen(false)}
            />
            <OnboardingModal
                isOpen={isOnboardingOpen}
                onClose={() => setIsOnboardingOpen(false)}
            />
        </ModuleErrorBoundary >
    );
}
