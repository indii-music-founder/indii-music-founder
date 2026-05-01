import React, { Suspense, lazy } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { AnimatePresence, motion } from 'framer-motion';

// Lazy-load Canvas and WaveMesh to break the vendor-three → vendor-react circular dependency
// This ensures Three.js is not loaded during app bootstrap
const CanvasRenderer = lazy(() => import('./CanvasRenderer'));

export const AudioVisualizer: React.FC = () => {
    const { isPlaying } = useStore(useShallow(state => ({
        isPlaying: state.isPlaying
    })));

    return (
        <AnimatePresence>
            {isPlaying && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.6 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                    className="fixed inset-0 z-0 pointer-events-none"
                >
                    <Suspense fallback={null}>
                        <CanvasRenderer />
                    </Suspense>

                    {/* Dark overlay to ensure UI readability */}
                    <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]" />
                </motion.div>
            )}
        </AnimatePresence>
    );
};
