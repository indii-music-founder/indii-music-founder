'use client';

import { motion } from 'framer-motion';

export default function BreathingText({
    children,
    className
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <motion.span
            className={className}
            animate={{
                opacity: [0.8, 1, 0.8],
                textShadow: [
                    "0 0 10px rgba(255,255,255,0.1)",
                    "0 0 20px rgba(255,255,255,0.3)",
                    "0 0 10px rgba(255,255,255,0.1)"
                ]
            }}
            transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
            }}
        >
            {children}
        </motion.span>
    );
}
