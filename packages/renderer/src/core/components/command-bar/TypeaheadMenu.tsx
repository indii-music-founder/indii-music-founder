import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, User, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/core/store';

export type TypeaheadContext = {
    type: '@' | '#';
    query: string;
    position: number;
} | null;

interface TypeaheadMenuProps {
    context: TypeaheadContext;
    onSelect: (value: string, display: string) => void;
}

// Hardcoded mock data for V1
const MOCK_AGENTS = [
    { id: 'director', name: 'Creative Director', role: 'Visuals & Design' },
    { id: 'finance', name: 'Finance Agent', role: 'Budget & Analytics' },
    { id: 'marketing', name: 'Marketing Agent', role: 'Campaigns & Copy' },
    { id: 'legal', name: 'Legal Agent', role: 'Contracts & Rights' }
];

const MOCK_ASSETS = [
    { id: 'brand-kit', name: 'Brand Kit 2026', type: 'document' },
    { id: 'q3-financials', name: 'Q3 Financials', type: 'spreadsheet' },
    { id: 'campaign-brief', name: 'Campaign Brief', type: 'document' }
];

export function TypeaheadMenu({ context, onSelect }: TypeaheadMenuProps) {
    if (!context) return null;

    const query = context.query.toLowerCase();

    // Filter based on context
    const items = context.type === '@'
        ? MOCK_AGENTS.filter(a => a.name.toLowerCase().includes(query) || a.role.toLowerCase().includes(query))
        : MOCK_ASSETS.filter(a => a.name.toLowerCase().includes(query));

    if (items.length === 0) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-full left-4 mb-2 w-64 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50"
            >
                <div className="px-3 py-2 border-b border-white/5 bg-white/5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {context.type === '@' ? 'Select Agent' : 'Reference Asset'}
                </div>
                <div className="max-h-60 overflow-y-auto p-1">
                    {items.map((item, i) => (
                        <button
                            key={item.id}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // Add a trailing space when completing
                                onSelect(item.id, item.name);
                            }}
                            className={cn(
                                "w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
                                i === 0 ? "bg-white/10" : "hover:bg-white/5"
                            )}
                        >
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center border border-white/5">
                                {context.type === '@' ? <User size={14} className="text-cyan-400" /> : <FileText size={14} className="text-purple-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-200 truncate">{item.name}</p>
                                <p className="text-xs text-gray-500 truncate">
                                    {context.type === '@' ? ('role' in item ? item.role : '') : 'Asset Resource'}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
