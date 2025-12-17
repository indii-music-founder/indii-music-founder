'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface PulseButtonProps extends HTMLMotionProps<"button"> {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary';
    className?: string;
}

export default function PulseButton({ children, className, variant = 'primary', ...props }: PulseButtonProps) {
    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={twMerge(
                "relative px-8 py-3 rounded-full font-medium transition-all duration-300 overflow-hidden group",
                variant === 'primary'
                    ? "bg-white text-void hover:text-resonance-blue"
                    : "bg-transparent border border-white/20 text-white hover:bg-white/5",
                "animate-throb-light", // The subliminal pulse
                className
            )}
            {...props}
        >
            {/* Background Glow (Invisible until hover/active, or pulsing) */}
            <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-r from-resonance-blue/20 to-frequency-pink/20 blur-xl" />

            <span className="relative z-10 flex items-center gap-2">
                {children}
            </span>
        </motion.button>
    );
}
