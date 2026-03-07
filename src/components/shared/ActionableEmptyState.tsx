import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, ArrowRight } from 'lucide-react';

interface ActionableEmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    colorClasses?: {
        text?: string;
        bg?: string;
        border?: string;
        glow?: string;
    };
}

export const ActionableEmptyState: React.FC<ActionableEmptyStateProps> = ({
    icon,
    title,
    description,
    actionLabel,
    onAction,
    colorClasses = {
        text: 'text-gray-400',
        bg: 'bg-white/5',
        border: 'border-white/10',
        glow: 'shadow-none'
    }
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={`w-full flex justify-center items-center py-24 px-6 rounded-[2.5rem] border border-dashed ${colorClasses.border} ${colorClasses.bg} relative overflow-hidden group`}
        >
            {/* Ambient Background Glow on Hover */}
            <div className={`absolute inset-0 bg-gradient-to-t ${(colorClasses.bg || 'bg-white/5').replace('/5', '/0')} to-transparent opacity-0 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none`} />

            <div className="relative z-10 flex flex-col items-center max-w-sm text-center">
                <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className={`p-5 rounded-[2rem] bg-black/20 border border-white/5 backdrop-blur-xl mb-6 flex items-center justify-center ${colorClasses.text} ${colorClasses.glow} transition-shadow duration-500`}
                >
                    {icon || <Sparkles size={40} />}
                </motion.div>

                <motion.h3
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-xl font-bold text-white tracking-tight mb-3"
                >
                    {title}
                </motion.h3>

                <motion.p
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-gray-500 text-sm font-medium leading-relaxed mb-8"
                >
                    {description}
                </motion.p>

                {actionLabel && onAction && (
                    <motion.button
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onAction}
                        className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-white transition-all shadow-xl bg-white/10 hover:bg-white/20 border border-white/10`}
                    >
                        {actionLabel}
                        <ArrowRight size={16} />
                    </motion.button>
                )}
            </div>
        </motion.div>
    );
};
