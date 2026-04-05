import React from 'react';
import { motion } from 'framer-motion';

export const CinematicTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Mock Cinematic App Transitions (Item 196)
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.02, y: -10 }}
            transition={{
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1], // Custom cinematic cubic bezier
                staggerChildren: 0.1
            }}
            className="w-full h-full"
        >
            {children}
        </motion.div>
    );
};
