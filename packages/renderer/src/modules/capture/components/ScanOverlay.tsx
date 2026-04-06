import React from 'react';
import { motion } from 'framer-motion';
import { ScanLine } from 'lucide-react';

/**
 * ScanOverlay — Blueprint-style scanning animation overlay.
 * Renders a scanning bar, HUD grid, corner brackets, and status text
 * over the captured image during the OCR analysis phase.
 */
export function ScanOverlay() {
    return (
        <div className="absolute inset-0 pointer-events-none">
            {/* Scanner Bar Animation */}
            <motion.div
                initial={{ top: '0%' }}
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 2, ease: "linear", repeat: Infinity }}
                className="absolute left-0 right-0 h-1 bg-teal-400 shadow-[0_0_15px_#2dd4bf] z-20"
            />

            {/* HUD Grid & Reticles */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(45,212,191,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(45,212,191,0.1)_1px,transparent_1px)] bg-[size:20px_20px]"></div>

            {/* Corner Brackets */}
            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-teal-500"></div>
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-teal-500"></div>
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-teal-500"></div>
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-teal-500"></div>

            {/* HUD Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <ScanLine className="text-teal-400 w-12 h-12 animate-pulse mb-4" />
                <span className="font-mono text-xs tracking-widest text-teal-400 font-bold bg-black/50 px-3 py-1 rounded">
                    ANALYZING PIXELS...
                </span>
                <span className="font-mono text-[10px] text-teal-400/70 mt-2">OCR TESSERACT ALLOCATED</span>
            </div>
        </div>
    );
}
