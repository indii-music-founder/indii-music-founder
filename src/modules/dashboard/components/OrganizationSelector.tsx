import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { Building2, Check, Plus, ChevronDown, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const OrganizationSelector = () => {
    const { organizations, currentOrganizationId, setOrganization, addOrganization } = useStore();
    const [isOpen, setIsOpen] = useState(false);
    const [showNewOrgInput, setShowNewOrgInput] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');

    const currentOrg = organizations.find(o => o.id === currentOrganizationId) || organizations[0];

    const handleCreateOrg = () => {
        if (!newOrgName.trim()) return;
        const newOrg = {
            id: `org-${Date.now()}`,
            name: newOrgName,
            plan: 'free' as const,
            members: ['me']
        };
        addOrganization(newOrg);
        setOrganization(newOrg.id);
        setNewOrgName('');
        setShowNewOrgInput(false);
        setIsOpen(false);
    };

    return (
        <div className="relative z-50">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 px-4 py-2 bg-[#1a1a1a] border border-gray-800 rounded-xl hover:border-gray-600 transition-colors"
            >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold">
                    {currentOrg.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="text-left hidden md:block">
                    <div className="text-xs text-gray-400">Organization</div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                        {currentOrg.name}
                        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => { setIsOpen(false); setShowNewOrgInput(false); }}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 mt-2 w-72 bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50"
                        >
                            <div className="p-2 space-y-1">
                                <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase">Switch Organization</div>
                                {organizations.map(org => (
                                    <button
                                        key={org.id}
                                        onClick={() => { setOrganization(org.id); setIsOpen(false); }}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${currentOrganizationId === org.id
                                            ? 'bg-purple-600/20 text-purple-400'
                                            : 'hover:bg-gray-800 text-gray-300'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Building2 size={16} />
                                            <span className="font-medium">{org.name}</span>
                                        </div>
                                        {currentOrganizationId === org.id && <Check size={16} />}
                                    </button>
                                ))}
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                    // @ts-expect-error - store module setter accepts validated routes only
                                    useStore.getState().setModule('select-org');
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-300 transition-colors border-t border-gray-800 mt-1"
                                >
                                    <Building2 size={16} />
                                    <span className="font-medium">Manage Organizations</span>
                                </button>
                            </div>

                            <div className="border-t border-gray-800 p-2">
                                {showNewOrgInput ? (
                                    <div className="p-2 bg-gray-800 rounded-lg">
                                        <input
                                            type="text"
                                            value={newOrgName}
                                            onChange={(e) => setNewOrgName(e.target.value)}
                                            placeholder="Org Name..."
                                            className="w-full bg-black/50 border border-gray-700 rounded px-2 py-1 text-sm text-white mb-2 focus:border-purple-500 outline-none"
                                            autoFocus
                                            onKeyDown={(e) => e.key === 'Enter' && handleCreateOrg()}
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleCreateOrg}
                                                disabled={!newOrgName.trim()}
                                                className="flex-1 bg-purple-600 text-white text-xs font-bold py-1 rounded hover:bg-purple-500 disabled:opacity-50"
                                            >
                                                Create
                                            </button>
                                            <button
                                                onClick={() => setShowNewOrgInput(false)}
                                                className="p-1 text-gray-400 hover:text-white"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowNewOrgInput(true)}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                                    >
                                        <Plus size={16} />
                                        Create New Organization
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div >
    );
};
