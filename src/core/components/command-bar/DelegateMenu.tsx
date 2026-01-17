import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DelegateMenuProps {
    isOpen: boolean;
    currentModule: string;
    managerAgents: { id: string; name: string; color: string; description: string }[];
    departmentAgents: { id: string; name: string; color: string; description: string }[];
    onSelect: (id: string) => void;
    onClose: () => void;
}

export const DelegateMenu = memo(({ isOpen, currentModule: _currentModule, managerAgents, departmentAgents, onSelect, onClose }: DelegateMenuProps) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute bottom-full left-0 mb-3 w-64 bg-[#0c0c0e]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden flex flex-col max-h-[350px] ring-1 ring-white/5"
                        role="menu"
                    >
                        <div className="overflow-y-auto custom-scrollbar">
                            <div className="p-1">
                                {/* indii removed from delegate menu as it has a dedicated toggle */}
                            </div>

                            <div className="border-t border-gray-800 my-1" />

                            <div className="p-2">
                                <p className="text-[10px] font-bold text-gray-500 uppercase px-2 mb-1">Manager's Office</p>
                                {managerAgents.map(agent => (
                                    <button
                                        key={agent.id}
                                        onClick={() => onSelect(agent.id)}
                                        className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all flex items-center gap-3 group"
                                        role="menuitem"
                                    >
                                        <div className={`w-2 h-2 rounded-full ${agent.color} shadow-[0_0_8px_rgba(255,255,255,0.2)] group-hover:scale-125 transition-transform`} />
                                        <span className="font-medium">{agent.name}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="border-t border-gray-800 my-1" />

                            <div className="p-2">
                                <p className="text-[10px] font-bold text-gray-500 uppercase px-2 mb-1">Departments</p>
                                {departmentAgents.map(dept => (
                                    <button
                                        key={dept.id}
                                        onClick={() => onSelect(dept.id)}
                                        className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                                        role="menuitem"
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${dept.color}`} />
                                        {dept.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
});
