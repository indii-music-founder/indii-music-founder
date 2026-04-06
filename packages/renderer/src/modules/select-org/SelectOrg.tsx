import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { Building2, Check, Plus, ArrowRight, Activity, Users, LogOut, ChevronRight, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SelectOrg() {
    const { organizations, currentOrganizationId, setOrganization, addOrganization, setModule, logout, userProfile, currentModule } = useStore(
        useShallow(s => ({
            organizations: s.organizations,
            currentOrganizationId: s.currentOrganizationId,
            setOrganization: s.setOrganization,
            addOrganization: s.addOrganization,
            setModule: s.setModule,
            logout: s.logout,
            userProfile: s.userProfile,
            currentModule: s.currentModule,
        }))
    );

    const [newOrgName, setNewOrgName] = useState('');
    const [showCreate, setShowCreate] = useState(organizations.length === 0);

    const handleCreate = () => {
        const name = newOrgName.trim();
        if (!name) return;
        const id = `org-${Date.now()}`;
        addOrganization({ id, name, plan: 'free', members: [] });
        setOrganization(id);
        setNewOrgName('');
        setShowCreate(false);
        setModule('dashboard');
    };

    const handleSelect = (orgId: string) => {
        setOrganization(orgId);
        setModule('dashboard');
    };

    // Derived states
    const hasOrgs = organizations.length > 0;
    const isSwitching = currentModule === 'select-org' && currentOrganizationId;

    return (
        <div className="fixed inset-0 bg-background text-white flex flex-col md:flex-row overflow-hidden selection:bg-purple-500/30">
            {/* Ambient Background Effects */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

            {/* Left Panel - Branding & Context */}
            <div className="hidden md:flex w-1/3 max-w-md relative flex-col justify-between p-12 border-r border-white/5 bg-black/40 backdrop-blur-xl z-10">
                <div>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center mb-8 shadow-lg shadow-purple-900/20">
                        <Activity className="text-white" size={24} />
                    </div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <h1 className="text-4xl font-black tracking-tighter mb-4 leading-tight">
                            {isSwitching ? 'SWITCH\nSTUDIOS' : 'SELECT\nYOUR STUDIO'}
                        </h1>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Welcome {userProfile?.displayName ? 'back, ' + userProfile.displayName : 'to indiiOS'}.
                            <br /><br />
                            Select an existing organization to orchestrate your creative agents, or establish a new studio to begin your journey.
                        </p>
                    </motion.div>
                </div>

                <div className="mt-12 space-y-6">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                        <div className="flex items-center gap-3 mb-2">
                            <Zap size={16} className="text-purple-400" />
                            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Multi-Tenant Vault</h3>
                        </div>
                        <p className="text-xs text-gray-500">Each studio maintains strict isolation for agents, billing, and distributed assets.</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 mt-auto pt-12">
                    <button onClick={logout} className="text-xs font-bold text-gray-500 hover:text-red-400 transition-colors uppercase tracking-widest flex items-center gap-2">
                        <LogOut size={12} /> Sign Out
                    </button>
                    {isSwitching && (
                        <button onClick={() => setModule('dashboard')} className="text-xs font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-widest ml-auto">
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            {/* Right Panel - Interactive Selection */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 z-10 relative overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="w-full max-w-lg"
                >
                    <AnimatePresence mode="wait">
                        {!showCreate && hasOrgs ? (
                            <motion.div
                                key="list"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-4"
                            >
                                <div className="flex items-center justify-between mb-8">
                                    <h2 className="text-2xl font-bold tracking-tight">Active Studios</h2>
                                    <p className="text-xs text-gray-500 font-mono">{organizations.length} AVAILABLE</p>
                                </div>

                                <div className="grid gap-3">
                                    {organizations.map(org => {
                                        const isActive = org.id === currentOrganizationId;
                                        return (
                                            <button
                                                key={org.id}
                                                onClick={() => handleSelect(org.id)}
                                                className={`group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 text-left overflow-hidden relative ${isActive
                                                        ? 'bg-purple-900/20 border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.15)]'
                                                        : 'bg-surface/40 border-white/10 hover:border-white/20 hover:bg-surface/60'
                                                    }`}
                                            >
                                                {isActive && (
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500" />
                                                )}
                                                <div className="flex items-center gap-4 relative z-10">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shrink-0 transition-colors ${isActive ? 'bg-purple-500 text-white' : 'bg-black/40 text-gray-400 group-hover:bg-white/10 group-hover:text-white'
                                                        }`}>
                                                        {org.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-base text-gray-100 mb-0.5">{org.name}</div>
                                                        <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                                                            <span className="capitalize text-purple-400">{org.plan} Plan</span>
                                                            <span className="w-1 h-1 rounded-full bg-gray-600" />
                                                            <span className="flex items-center gap-1"><Users size={12} /> {org.members?.length || 1} Member{org.members?.length !== 1 ? 's' : ''}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="relative z-10 flex items-center">
                                                    {isActive ? (
                                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 text-purple-400">
                                                            <Check size={16} strokeWidth={3} />
                                                        </div>
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-white group-hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0">
                                                            <ChevronRight size={16} />
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="mt-8 pt-8 border-t border-white/5">
                                    <button
                                        onClick={() => setShowCreate(true)}
                                        className="w-full group flex items-center justify-center gap-3 p-4 rounded-xl border border-dashed border-white/20 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all text-gray-400 hover:text-purple-300 font-bold"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-purple-500/20 flex items-center justify-center transition-colors">
                                            <Plus size={16} />
                                        </div>
                                        Provide New Studio
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="create"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-blue-500" />

                                <div className="mb-8">
                                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 mb-6">
                                        <Building2 size={24} />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-2">Create New Studio</h2>
                                    <p className="text-gray-400 text-sm">Provision a new isolated workspace for your projects, agents, and team.</p>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                            Studio Name
                                        </label>
                                        <input
                                            type="text"
                                            value={newOrgName}
                                            onChange={e => setNewOrgName(e.target.value)}
                                            placeholder="e.g. IndiiOS Records, My Agency"
                                            autoFocus
                                            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                                            className="w-full bg-black/40 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-4 text-base text-white placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-purple-500/20 transition-all"
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        {hasOrgs && (
                                            <button
                                                onClick={() => { setShowCreate(false); setNewOrgName(''); }}
                                                className="px-6 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 font-bold transition-colors"
                                            >
                                                Back
                                            </button>
                                        )}
                                        <button
                                            onClick={handleCreate}
                                            disabled={!newOrgName.trim()}
                                            className="flex-1 bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-black rounded-xl py-3 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_40px_rgba(255,255,255,0.4)]"
                                        >
                                            Provision Studio <ArrowRight size={18} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
}
