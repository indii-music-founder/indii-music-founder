import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ScanOverlay } from './ScanOverlay';

interface CapturePreviewProps {
    imagePreview: string;
    isScanning: boolean;
    scanComplete: boolean;
    onTransmit: () => void;
}

/**
 * CapturePreview — Post-capture view showing the image with scanning overlay.
 * Displays the blueprint scanning animation during OCR analysis and a
 * "Transmit to Studio" CTA button upon completion.
 */
export function CapturePreview({ imagePreview, isScanning, scanComplete, onTransmit }: CapturePreviewProps) {
    return (
        <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-0 bg-black flex items-center justify-center p-4"
        >
            <div className="relative w-full max-w-md aspect-[3/4] rounded-xl overflow-hidden shadow-2xl border border-gray-800">
                <img
                    src={imagePreview}
                    alt="Captured Document"
                    className={`w-full h-full object-cover transition-all duration-1000 ${isScanning ? 'brightness-50 grayscale' : 'brightness-100'}`}
                />

                {/* The "Blueprint" Scanning UI */}
                {isScanning && <ScanOverlay />}

                {/* Completion Overlay */}
                {scanComplete && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-green-500/20 backdrop-blur-[2px] flex items-center justify-center pointer-events-none"
                    >
                        <div className="bg-green-500 text-black font-bold px-6 py-3 rounded-full flex items-center gap-2 shadow-[0_0_30px_#22c55e]">
                            INGEST COMPLETE
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Action Footer for Post-Scan */}
            <AnimatePresence>
                {scanComplete && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute bottom-8 left-0 right-0 flex justify-center px-6"
                    >
                        <button
                            onClick={onTransmit}
                            className="w-full max-w-sm bg-gradient-to-r from-teal-500 to-indigo-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 transition-transform"
                        >
                            Transmit to Studio <ArrowRight size={20} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
