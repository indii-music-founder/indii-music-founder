import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { AnimatePresence, motion } from 'framer-motion';
import WaveMesh from './WaveMesh';

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
                    <Canvas
                        camera={{ position: [0, 5, 10], fov: 45 }}
                        dpr={[1, 2]}
                        gl={{ antialias: true, alpha: true }}
                    >
                        <Suspense fallback={null}>
                            <WaveMesh />
                        </Suspense>
                    </Canvas>
                    
                    {/* Dark overlay to ensure UI readability */}
                    <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]" />
                </motion.div>
            )}
        </AnimatePresence>
    );
};
