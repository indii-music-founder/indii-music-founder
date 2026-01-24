import React, { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Generic Properties Panel Container ---

interface PropertiesPanelProps {
    title?: string;
    children: ReactNode;
    className?: string;
}

export function PropertiesPanel({ title = "Properties", children, className = "" }: PropertiesPanelProps) {
    return (
        <div className={`w-80 h-full bg-bg-dark border-l border-gray-800 flex flex-col overflow-hidden ${className}`}>
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
        <div className="border-b border-gray-800">
            <div className="flex items-center justify-between p-3 bg-gray-900/30 hover:bg-gray-900/50 transition-colors cursor-pointer group" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />}
                    <span className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">{title}</span>
                </div>
                {actions && <div onClick={e => e.stopPropagation()}>{actions}</div>}
            </div>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        <div className="p-3 bg-bg-dark">
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
        <div className={`mb-3 last:mb-0 ${className}`}>
            <label className="block text-[10px] font-medium text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
            {children}
        </div>
    );
}

// ... other inputs can be added here as needed (Input, Select, Slider)
