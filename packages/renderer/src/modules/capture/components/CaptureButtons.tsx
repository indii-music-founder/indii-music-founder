import React from 'react';
import { Camera, Upload } from 'lucide-react';
import { motion } from 'framer-motion';

const clayButtonStyles = "relative overflow-hidden bg-card/60 backdrop-blur-md border border-white/5 text-white rounded-3xl p-6 flex flex-col items-center justify-center gap-3 transition-all hover:bg-card/80 active:scale-95 shadow-lg shadow-black/50 hover:shadow-[inset_0_2px_10px_rgba(255,255,255,0.05)]";

interface CaptureButtonsProps {
    onCapture: () => void;
}

/**
 * CaptureButtons — Pre-capture action cards (Snap Photo / Upload File).
 * Uses claymorphism-inspired styling with tactile hover and press feedback.
 */
export function CaptureButtons({ onCapture }: CaptureButtonsProps) {
    return (
        <motion.div
            key="buttons"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-sm grid grid-cols-2 gap-6 mt-auto mb-24"
        >
            <button onClick={onCapture} className={clayButtonStyles}>
                <div className="p-4 rounded-full bg-teal-500/20 text-teal-400">
                    <Camera size={28} />
                </div>
                <span className="font-medium text-sm">Snap Photo</span>
            </button>

            <button onClick={onCapture} className={clayButtonStyles}>
                <div className="p-4 rounded-full bg-indigo-500/20 text-indigo-400">
                    <Upload size={28} />
                </div>
                <span className="font-medium text-sm">Upload File</span>
            </button>
        </motion.div>
    );
}
