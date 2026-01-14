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
import { CreateContactModal } from './components/CreateContactModal';
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
    const [isCreateCampaignModalOpen, setIsCreateCampaignModalOpen] = useState(false);
    const [isCreateContactModalOpen, setIsCreateContactModalOpen] = useState(false);
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
            <div className="flex h-screen w-full bg-[#0a0a0a] text-slate-200 font-sans overflow-hidden selection:bg-purple-500/30 relative">
                {/* Global Background Ambience */}
                <div className="fixed inset-0 pointer-events-none z-0">
                    <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-purple-900/10 blur-[150px]" />
                    <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-900/10 blur-[150px]" />
                    <div className="absolute top-[40%] left-[40%] w-[40%] h-[40%] bg-indigo-500/5 blur-[120px] animate-pulse-slow" />
                </div>

                {/* Sidebar Navigation */}
                <aside className="w-64 lg:w-72 h-full z-20 flex flex-col border-r border-white/5 bg-black/40 backdrop-blur-xl relative">
                    {/* Brand */}
                    <div className="p-6 pb-2">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center border border-white/10 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                                <Mic size={20} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-white leading-tight">Publicist<span className="text-purple-500">.</span></h1>
                                <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">PR & Media</p>
                            </div>
                        </div>

                        {/* Quick Stats Mini-Ticker (Vertical) */}
                        <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Global Reach</div>
                                <div className="text-lg font-bold text-white">{stats.globalReach}</div>
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Open Rate</div>
                                <div className="text-lg font-bold text-emerald-400">{stats.avgOpenRate}</div>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Menu */}
                    <nav className="flex-1 px-4 space-y-2 overflow-y-auto no-scrollbar">
                        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2 mb-2">Main Menu</div>

                        <NavButton
                            isActive={activeTab === 'campaigns'}
                            onClick={() => setActiveTab('campaigns')}
                            icon={Megaphone}
                            label="Campaigns"
                        />
                        <NavButton
                            isActive={activeTab === 'contacts'}
                            onClick={() => setActiveTab('contacts')}
                            icon={Users}
                            label="Media Network"
                        />
                        {/* Reports & Identity - Future / Lower priority tabs */}
                        <NavButton
                            isActive={false}
                            onClick={() => { }} // Placeholder
                            icon={ArrowUpRight}
                            label="Analytics & Reports"
                            disabled
                        />
                        <div className="pt-6 pb-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2 mb-2">Tools</div>
                        <button
                            onClick={() => setIsOnboardingOpen(true)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all group text-sm font-medium"
                        >
                            <Sparkles size={16} className="text-purple-400 opacity-70 group-hover:opacity-100" />
                            <span>Brand Identity</span>
                        </button>
                        <button
                            onClick={() => setIsTipsOpen(true)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all group text-sm font-medium"
                        >
                            <Sparkles size={16} className="text-indigo-400 opacity-70 group-hover:opacity-100" />
                            <span>Pro Tips</span>
                        </button>
                    </nav>

                    {/* User Profile / Footer */}
                    <div className="p-4 border-t border-white/5">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                                {userProfile?.bio ? userProfile.bio.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-white truncate">Connected</div>
                                <div className="text-[10px] text-emerald-400 truncate">Online</div>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 relative flex flex-col min-w-0 z-10 h-full">
                    {/* Top HUD Bar */}
                    <header className="h-20 shrink-0 px-8 flex items-center justify-between border-b border-white/5 bg-black/20 backdrop-blur-sm z-20">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-bold text-white tracking-tight">
                                {activeTab === 'campaigns' ? 'Campaigns' : 'Media Network'}
                            </h2>
                            <div className="h-6 w-px bg-white/10 mx-2" />

                            {/* Search Bar */}
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-400 transition-colors" size={14} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={activeTab === 'campaigns' ? "Search campaigns..." : "Search contacts..."}
                                    className="w-64 bg-black/20 border border-white/10 rounded-full py-1.5 pl-9 pr-4 text-xs font-medium text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all hover:border-white/20"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Filter Controls (Visible on Campaign Tab) */}
                            {activeTab === 'campaigns' && (
                                <>
                                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
                                        <button
                                            onClick={() => setViewMode('grid')}
                                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}
                                        >
                                            <LayoutGrid size={14} />
                                        </button>
                                        <button
                                            onClick={() => setViewMode('list')}
                                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}
                                        >
                                            <List size={14} />
                                        </button>
                                    </div>
                                    <select
                                        value={filterType}
                                        onChange={(e) => setFilterType(e.target.value as any)}
                                        className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-slate-300 focus:outline-none hover:border-white/20 transition-colors"
                                    >
                                        <option value="all" className="bg-slate-900">All Status</option>
                                        <option value="Live" className="bg-slate-900">Live</option>
                                        <option value="Scheduled" className="bg-slate-900">Scheduled</option>
                                        <option value="Draft" className="bg-slate-900">Draft</option>
                                    </select>
                                </>
                            )}

                            {activeTab === 'campaigns' ? (
                                <button
                                    onClick={() => setIsCreateCampaignModalOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-xs font-bold hover:bg-slate-200 transition-all active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.1)] ml-2"
                                >
                                    <Plus size={14} />
                                    <span>New Campaign</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsCreateContactModalOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-xs font-bold hover:bg-slate-200 transition-all active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.1)] ml-2"
                                >
                                    <Plus size={14} />
                                    <span>New Contact</span>
                                </button>
                            )}
                        </div>
                    </header>

                    {/* Scrollable Content Stage */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 scroll-smooth no-scrollbar">
                        <AnimatePresence mode="wait">
                            {activeTab === 'campaigns' ? (
                                <motion.div
                                    key="campaigns-view"
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={{ duration: 0.2 }}
                                    className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4' : 'grid-cols-1'}`}
                                >
                                    {/* Campaign Cards */}
                                    <AnimatePresence mode="popLayout">
                                        {campaigns.map((campaign) => (
                                            <CampaignCard
                                                key={campaign.id}
                                                campaign={campaign}
                                                onClick={(c) => setSelectedCampaign(c)}
                                            />
                                        ))}
                                    </AnimatePresence>

                                    {/* Empty State */}
                                    {campaigns.length === 0 && (
                                        <div className="col-span-full py-32 flex flex-col items-center justify-center text-center opacity-50">
                                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                                <Megaphone size={32} className="text-slate-500" />
                                            </div>
                                            <h3 className="text-lg font-bold text-white mb-2">No Campaigns Yet</h3>
                                            <p className="text-sm text-slate-400 max-w-xs mx-auto">Start your first campaign to begin reaching out to media contacts.</p>
                                        </div>
                                    )}

                                    {/* Add New Ghost Card (Grid Only) */}
                                    {viewMode === 'grid' && (
                                        <motion.button
                                            onClick={() => setIsCreateCampaignModalOpen(true)}
                                            whileHover={{ scale: 1.01, backgroundColor: "rgba(255,255,255,0.03)" }}
                                            whileTap={{ scale: 0.98 }}
                                            className="group flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-white/5 rounded-2xl transition-all h-full min-h-[300px]"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-white/10 flex items-center justify-center transition-colors">
                                                <Plus size={20} className="text-slate-500 group-hover:text-white" />
                                            </div>
                                            <span className="text-xs font-bold text-slate-500 group-hover:text-white transition-colors">Create New Campaign</span>
                                        </motion.button>
                                    )}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="contacts-view"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                    className="max-w-5xl mx-auto"
                                >
                                    {/* Stats Summary for Contacts */}
                                    <div className="grid grid-cols-3 gap-6 mb-8">
                                        <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                                            <div className="text-3xl font-black text-white mb-1">{contacts.length}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Contacts</div>
                                        </div>
                                        <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                                            <div className="text-3xl font-black text-purple-400 mb-1">{contacts.filter(c => c.tier === 'Top').length}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Top Tier</div>
                                        </div>
                                        <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                                            <div className="text-3xl font-black text-blue-400 mb-1">{contacts.filter(c => c.influenceScore > 80).length}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Influencers</div>
                                        </div>
                                    </div>

                                    {/* Contact List */}
                                    <div className="glass-panel rounded-3xl p-6 border border-white/5">
                                        <ContactList
                                            contacts={contacts}
                                            onSelectContact={(c) => setSelectedContact(c)}
                                        />
                                        {contacts.length === 0 && (
                                            <div className="py-20 text-center text-slate-500 text-sm">
                                                No contacts found.
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </main>
            </div>

            {/* Modals */}
            <CreateCampaignModal
                isOpen={isCreateCampaignModalOpen}
                onClose={() => setIsCreateCampaignModalOpen(false)}
                userId={userProfile?.uid || ''}
            />
            <CreateContactModal
                isOpen={isCreateContactModalOpen}
                onClose={() => setIsCreateContactModalOpen(false)}
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

// Sub-component for Sidebar Navigation Buttons
function NavButton({ isActive, onClick, icon: Icon, label, disabled }: { isActive: boolean; onClick: () => void; icon: any; label: string; disabled?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group
                ${isActive
                    ? 'bg-purple-600/10 text-white shadow-[0_0_15px_rgba(168,85,247,0.15)] border border-purple-500/20'
                    : disabled
                        ? 'text-slate-600 cursor-not-allowed'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'}
            `}
        >
            <Icon
                size={18}
                className={`
                    transition-colors 
                    ${isActive ? 'text-purple-400' : disabled ? 'text-slate-700' : 'text-slate-500 group-hover:text-slate-300'}
                `}
            />
            <span>{label}</span>
            {disabled && <span className="ml-auto text-[8px] bg-white/5 px-1.5 py-0.5 rounded text-slate-600 uppercase font-bold">Soon</span>}
            {isActive && <motion.div layoutId="active-indicator" className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />}
        </button>
    );
}
