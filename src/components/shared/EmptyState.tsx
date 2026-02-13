import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    variant?: 'center' | 'minimal';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    description,
    action,
    variant = 'center'
}) => {
    if (variant === 'minimal') {
        return (
            <div className="flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-gray-800 rounded-xl bg-gray-900/50">
                <Icon className="text-gray-600 mb-3" size={32} />
                <h3 className="text-gray-300 font-medium mb-1">{title}</h3>
                <p className="text-gray-500 text-sm mb-4 max-w-xs">{description}</p>
                {action && (
                    <button
                        onClick={action.onClick}
                        className="text-xs font-bold text-sky-400 hover:text-sky-300 uppercase tracking-widest transition-colors"
                    >
                        {action.label}
                    </button>
                )}
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 px-6 text-center"
        >
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-sky-500/20 blur-3xl rounded-full" />
                <div className="relative w-20 h-20 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center text-sky-400 shadow-2xl">
                    <Icon size={40} strokeWidth={1.5} />
                </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
            <p className="text-gray-400 max-w-sm mb-8 leading-relaxed">
                {description}
            </p>

            {action && (
                <button
                    onClick={action.onClick}
                    className="group relative px-6 py-3 bg-white text-black font-bold rounded-full overflow-hidden transition-transform active:scale-95"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-sky-400 to-indigo-500 opacity-0 group-hover:opacity-10 transition-opacity" />
                    <span className="relative z-10">{action.label}</span>
                </button>
            )}
        </motion.div>
    );
};
