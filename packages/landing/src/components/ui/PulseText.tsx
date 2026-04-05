'use client';

import { motion } from 'framer-motion';

export default function PulseText({
    children,
    className
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <motion.div
            className={className}
            animate={{
                scale: [1, 1.01, 1],
                opacity: [0.9, 1, 0.9],
            }}
            transition={{
                duration: 4,
                ease: "easeInOut",
                repeat: Infinity,
            }}
        >
            {children}
        </motion.div>
    );
}
