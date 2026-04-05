import React, { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

// --- Generic Properties Panel Container ---

interface PropertiesPanelProps {
    title?: string;
    children: ReactNode;
    className?: string;
}

export function PropertiesPanel({ title = "Properties", children, className = "" }: PropertiesPanelProps) {
    return (
        <div className={cn("w-64 shrink-0 h-full bg-bg-dark border-l border-gray-800 flex flex-col overflow-hidden", className)}>
            <div className="h-10 border-b border-gray-800 flex items-center px-4 shrink-0 bg-bg-dark">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                {children}
            </div>
        </div>
    );
}

// --- Section Component ---

interface PanelSectionProps {
    title: string;
    children: ReactNode;
    defaultOpen?: boolean;
    actions?: ReactNode;
}

export function PanelSection({ title, children, defaultOpen = true, actions }: PanelSectionProps) {
    const [isOpen, setIsOpen] = React.useState(defaultOpen);

    return (
        <div className="border-b border-[#1a1a1a]">
            <div className="flex items-center bg-[#0a0a0a] hover:bg-[#111] transition-colors group">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1.5 flex-1 p-2 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-blue-500"
                    aria-expanded={isOpen}
                >
                    {isOpen ? <ChevronDown size={10} className="text-gray-500" /> : <ChevronRight size={10} className="text-gray-500" />}
                    <span className="text-[10px] font-semibold text-gray-300 group-hover:text-white transition-colors">{title}</span>
                </button>
                {actions && <div className="pr-2 flex items-center">{actions}</div>}
            </div>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="p-2.5 bg-bg-dark">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// --- Form Components ---

interface PropertyRowProps {
    label: string;
    children: ReactNode;
    className?: string;
}

export function PropertyRow({ label, children, className = "" }: PropertyRowProps) {
    return (
        <div className={`mb-2.5 last:mb-0 ${className}`}>
            <label className="block text-[8px] font-bold text-gray-500 mb-1 uppercase tracking-widest">{label}</label>
            {children}
        </div>
    );
}

// ... other inputs can be added here as needed (Input, Select, Slider)
