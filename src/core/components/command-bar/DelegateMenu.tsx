import React, { memo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface DelegateMenuProps {
    isOpen: boolean;
    currentModule: string;
    isIndiiMode?: boolean;
    managerAgents: { id: string; name: string; color: string; description: string }[];
    departmentAgents: { id: string; name: string; color: string; description: string }[];
    onSelect: (id: string) => void;
    onSelectIndii?: () => void;
    onClose: () => void;
}

export const DelegateMenu = memo(({ isOpen, currentModule: _currentModule, isIndiiMode, managerAgents, departmentAgents, onSelect, onSelectIndii, onClose }: DelegateMenuProps) => {
    const menuRef = useRef<HTMLDivElement>(null);

    // Handle Escape key and initial focus
    useEffect(() => {
        if (isOpen) {
            // Move focus to the menu container when opened
            // Use requestAnimationFrame to ensure the element is mounted and transitioned
            const timer = setTimeout(() => {
                menuRef.current?.focus();
            }, 50);

            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    onClose();
                }
            };

            document.addEventListener('keydown', handleKeyDown);
            return () => {
                document.removeEventListener('keydown', handleKeyDown);
                clearTimeout(timer);
            };
        }
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={onClose}
                        aria-hidden="true"
                    />
                    <motion.div
                        ref={menuRef}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute bottom-full left-0 mb-3 w-64 bg-[#0c0c0e]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] z-50 overflow-hidden flex flex-col max-h-[350px] ring-1 ring-white/5 outline-none"
                        role="menu"
                        tabIndex={-1}
                        aria-label="Delegate to agent"
                    >
                        <div className="overflow-y-auto custom-scrollbar">
                            <div className="p-2">
                                <button
                                    onClick={() => onSelectIndii?.()}
                                    className={`w-full text-left px-3 py-2.5 text-xs rounded-lg transition-all flex items-center gap-3 group focus:outline-none ${isIndiiMode
                                            ? 'bg-purple-600/20 text-purple-200'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                    role="menuitem"
                                >
                                    <div className={`w-2 h-2 rounded-full ${isIndiiMode ? 'bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]' : 'bg-purple-600'} group-hover:scale-125 transition-transform`} />
                                    <div>
                                        <span className="font-semibold">indii</span>
                                        <span className="text-[10px] text-gray-500 ml-2">Orchestrator</span>
                                    </div>
                                </button>
                            </div>

                            <div className="border-t border-gray-800 my-1" />

                            <div className="p-2">
                                <p className="text-[10px] font-bold text-gray-500 uppercase px-2 mb-1" id="managers-label">Manager's Office</p>
                                <div role="group" aria-labelledby="managers-label">
                                    {managerAgents.map(agent => (
                                        <button
                                            key={agent.id}
                                            onClick={() => onSelect(agent.id)}
                                            className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all flex items-center gap-3 group focus:bg-white/10 focus:text-white outline-none"
                                            role="menuitem"
                                        >
                                            <div className={`w-2 h-2 rounded-full ${agent.color} shadow-[0_0_8px_rgba(255,255,255,0.2)] group-hover:scale-125 transition-transform`} />
                                            <span className="font-medium">{agent.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-gray-800 my-1" />

                            <div className="p-2">
                                <p className="text-[10px] font-bold text-gray-500 uppercase px-2 mb-1" id="departments-label">Departments</p>
                                <div role="group" aria-labelledby="departments-label">
                                    {departmentAgents.map(dept => (
                                        <button
                                            key={dept.id}
                                            onClick={() => onSelect(dept.id)}
                                            className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2 focus:bg-white/10 outline-none"
                                            role="menuitem"
                                        >
                                            <div className={`w-1.5 h-1.5 rounded-full ${dept.color}`} />
                                            {dept.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
});
