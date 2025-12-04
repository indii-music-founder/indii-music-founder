import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string, type: 'creative' | 'music' | 'marketing' | 'legal') => Promise<void>;
    error: string | null;
}

export default function NewProjectModal({ isOpen, onClose, onCreate, error }: NewProjectModalProps) {
    const [name, setName] = useState('');
    const [type, setType] = useState<'creative' | 'music' | 'marketing' | 'legal'>('creative');

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="glass-panel rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
                <h2 className="text-2xl font-bold text-white mb-6">Create New Project</h2>
                {error && (
                    <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-white/50 uppercase mb-1">Project Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter project name..."
                            className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:border-neon-purple outline-none"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-white/50 uppercase mb-1">Project Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['creative', 'music', 'marketing', 'legal'].map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setType(t as any)}
                                    className={`p-3 rounded-lg border text-sm font-medium capitalize transition-all ${type === t
                                        ? 'bg-neon-purple/20 border-neon-purple text-neon-purple'
                                        : 'bg-black/50 border-white/10 text-white/50 hover:border-white/30'
                                        } `}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg font-bold transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onCreate(name, type)}
                            disabled={!name.trim()}
                            className="flex-1 py-3 bg-white hover:bg-neon-blue hover:text-black text-black rounded-lg font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Create Project
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
