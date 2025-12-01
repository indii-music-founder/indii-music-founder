import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { Building2, Plus, Check } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SelectOrg() {
    console.log('SelectOrg: Component Mounting');
    const { organizations, currentOrganizationId, setOrganization, addOrganization, setModule } = useStore();
    console.log('SelectOrg: State loaded', { organizations, currentOrganizationId });
    const [isCreating, setIsCreating] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');

    const handleSelect = (orgId: string) => {
        setOrganization(orgId);
        setModule('dashboard');
    };

    const handleCreate = () => {
        if (!newOrgName.trim()) return;
        const newOrg = {
            id: `org-${Date.now()}`,
            name: newOrgName,
            plan: 'free' as const,
            members: ['me']
        };
        addOrganization(newOrg);
        setOrganization(newOrg.id);
        setModule('dashboard');
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-black text-white p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-white rounded-2xl mx-auto mb-6 flex items-center justify-center">
                        <span className="text-3xl font-bold text-black tracking-tighter">ii</span>
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Select Organization</h1>
                    <p className="text-gray-500">Choose a workspace to continue</p>
                </div>

                <div className="space-y-3 mb-8">
                    {organizations.map(org => (
                        <button
                            key={org.id}
                            onClick={() => handleSelect(org.id)}
                            className="w-full p-4 bg-[#111] border border-[#222] rounded-xl hover:border-white/20 hover:bg-[#1a1a1a] transition-all flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-[#222] flex items-center justify-center text-gray-400 group-hover:text-white transition-colors">
                                    <Building2 size={20} />
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-white">{org.name}</div>
                                    <div className="text-xs text-gray-500">{org.members.length} members</div>
                                </div>
                            </div>
                            {currentOrganizationId === org.id && (
                                <div className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center">
                                    <Check size={14} />
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                {isCreating ? (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="bg-[#111] border border-[#222] rounded-xl p-4"
                    >
                        <h3 className="font-bold mb-4">Create New Organization</h3>
                        <input
                            type="text"
                            value={newOrgName}
                            onChange={(e) => setNewOrgName(e.target.value)}
                            placeholder="Organization Name"
                            className="w-full bg-black border border-[#333] rounded-lg p-3 text-white mb-4 focus:border-white outline-none transition-colors"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsCreating(false)}
                                className="flex-1 py-2 px-4 rounded-lg border border-[#333] hover:bg-[#222] transition-colors font-medium text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={!newOrgName.trim()}
                                className="flex-1 py-2 px-4 rounded-lg bg-white text-black hover:bg-gray-200 transition-colors font-bold text-sm disabled:opacity-50"
                            >
                                Create
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="w-full py-3 border border-dashed border-[#333] rounded-xl text-gray-500 hover:text-white hover:border-gray-500 transition-all flex items-center justify-center gap-2 font-medium"
                    >
                        <Plus size={18} />
                        Create New Organization
                    </button>
                )}
            </motion.div>
        </div>
    );
}
