import { useState } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { Building2, Check, Plus, Trash2, X, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

export default function SelectOrg() {
    const { organizations, currentOrganizationId, setOrganization, addOrganization, setModule } = useStore(
        useShallow(s => ({
            organizations: s.organizations,
            currentOrganizationId: s.currentOrganizationId,
            setOrganization: s.setOrganization,
            addOrganization: s.addOrganization,
            setModule: s.setModule,
        }))
    );

    const [newOrgName, setNewOrgName] = useState('');
    const [showCreate, setShowCreate] = useState(false);

    const handleCreate = () => {
        const name = newOrgName.trim();
        if (!name) return;
        const id = `org-${Date.now()}`;
        addOrganization({ id, name, plan: 'free', members: [] });
        setOrganization(id);
        setNewOrgName('');
        setShowCreate(false);
    };

    const handleSelect = (orgId: string) => {
        setOrganization(orgId);
        setModule('dashboard');
    };

    return (
        <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-md">
                {/* Back button */}
                <button
                    onClick={() => setModule('dashboard')}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-8 transition-colors"
                >
                    <ArrowLeft size={16} />
                    Back to dashboard
                </button>

                <h1 className="text-2xl font-bold text-white mb-1">Organizations</h1>
                <p className="text-sm text-gray-500 mb-8">Switch between workspaces or create a new one.</p>

                <div className="space-y-2">
                    {organizations.map(org => {
                        const isActive = org.id === currentOrganizationId;
                        return (
                            <motion.button
                                key={org.id}
                                layout
                                onClick={() => handleSelect(org.id)}
                                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left ${
                                    isActive
                                        ? 'bg-purple-600/15 border-purple-500/40 text-white'
                                        : 'bg-[#161b22] border-gray-800 hover:border-gray-600 text-gray-300'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                        {org.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-sm">{org.name}</div>
                                        <div className="text-xs text-gray-500 capitalize">{org.plan} plan</div>
                                    </div>
                                </div>
                                {isActive && (
                                    <div className="flex items-center gap-1.5 text-purple-400 text-xs font-semibold">
                                        <Check size={14} />
                                        Active
                                    </div>
                                )}
                            </motion.button>
                        );
                    })}
                </div>

                {/* Create new org */}
                <div className="mt-4">
                    {showCreate ? (
                        <div className="bg-[#161b22] border border-gray-700 rounded-xl p-4">
                            <label className="block text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wide">
                                Organization name
                            </label>
                            <input
                                type="text"
                                value={newOrgName}
                                onChange={e => setNewOrgName(e.target.value)}
                                placeholder="e.g. My Label"
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
                                className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 mb-3"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCreate}
                                    disabled={!newOrgName.trim()}
                                    className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                                >
                                    Create
                                </button>
                                <button
                                    onClick={() => { setShowCreate(false); setNewOrgName(''); }}
                                    className="p-2 text-gray-400 hover:text-white transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowCreate(true)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-gray-700 hover:border-gray-500 text-gray-500 hover:text-gray-300 text-sm transition-colors"
                        >
                            <Plus size={16} />
                            New Organization
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
