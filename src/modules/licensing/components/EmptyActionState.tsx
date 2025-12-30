import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, LucideIcon, PlusCircle } from 'lucide-react';

interface EmptyActionStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    secondaryLabel?: string;
    onSecondary?: () => void;
    gradient?: string;
}

export const EmptyActionState: React.FC<EmptyActionStateProps> = ({
    icon: Icon,
    title,
    description,
    actionLabel,
    onAction,
    secondaryLabel,
    onSecondary,
    gradient = 'from-indigo-500/20 to-purple-500/20'
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#1c2128] p-8 md:p-12 text-center"
        >
            {/* Ambient Background Glow */}
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-700 blur-3xl`} />

            <div className="relative z-10 flex flex-col items-center max-w-lg mx-auto">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-white/10 blur-xl rounded-full" />
                    <div className="relative p-6 bg-white/5 rounded-[2rem] border border-white/10 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                        <Icon size={48} className="text-white opacity-80" strokeWidth={1.5} />
                    </div>
                </div>

                <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">
                    {title}
                </h3>

                <p className="text-gray-400 mb-8 leading-relaxed">
                    {description}
                </p>

                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                    {actionLabel && onAction && (
                        <button
                            onClick={onAction}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-bold hover:bg-gray-100 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                        >
                            <PlusCircle size={18} />
                            {actionLabel}
                        </button>
                    )}

                    {secondaryLabel && onSecondary && (
                        <button
                            onClick={onSecondary}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium border border-white/10 transition-all hover:border-white/20"
                        >
                            {secondaryLabel}
                            <ArrowRight size={16} />
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
};
