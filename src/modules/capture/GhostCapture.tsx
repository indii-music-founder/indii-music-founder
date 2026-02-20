import React, { useState, useRef } from 'react';
import { Camera, Upload, X, ScanLine, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- CLAYMORPHISM STYLES ---
// Using soft inset shadows and bright highlights to create tactile, 3D buttons.
const clayButtonStyles = "relative overflow-hidden bg-gray-800 text-white rounded-3xl p-6 flex flex-col items-center justify-center gap-3 transition-transform hover:scale-105 active:scale-95 shadow-[8px_8px_16px_#0a0f16,-8px_-8px_16px_#263346,inset_2px_2px_4px_rgba(255,255,255,0.1)]";

export default function GhostCapture() {
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanComplete, setScanComplete] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
                startMockIngest();
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const startMockIngest = () => {
        // Trigger the Blueprint Overlay "Scanning" phase
        setIsScanning(true);
        setScanComplete(false);

        // Simulate backend OCR pipeline delay
        setTimeout(() => {
            setIsScanning(false);
            setScanComplete(true);
        }, 3000);
    };

    const resetCapture = () => {
        setImagePreview(null);
        setIsScanning(false);
        setScanComplete(false);
    };

    return (
        <div className="fixed inset-0 bg-[#0f141e] text-white overflow-hidden flex flex-col supports-[height:100dvh]:h-[100dvh]">

            {/* Header */}
            <header className="px-6 py-4 flex justify-between items-center z-10">
                <div className="flex flex-col">
                    <span className="text-xs text-teal-500 font-mono tracking-widest uppercase">Mobile Link</span>
                    <h1 className="text-xl font-bold tracking-tight">Ghost Capture</h1>
                </div>
                {imagePreview && !isScanning && (
                    <button onClick={resetCapture} className="p-2 bg-gray-800/50 rounded-full hover:bg-gray-700 transition">
                        <X size={20} />
                    </button>
                )}
            </header>

            {/* Main View Area */}
            <main className="flex-1 relative flex flex-col justify-center items-center p-6">

                <AnimatePresence mode="wait">
                    {!imagePreview ? (
                        // --- PRE-CAPTURE: CLAYMORPHISM ACTION BUTTONS ---
                        <motion.div
                            key="buttons"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-sm grid grid-cols-2 gap-6 mt-auto mb-24"
                        >
                            <button onClick={triggerFileInput} className={clayButtonStyles}>
                                <div className="p-4 rounded-full bg-teal-500/20 text-teal-400">
                                    <Camera size={28} />
                                </div>
                                <span className="font-medium text-sm">Snap Photo</span>
                            </button>

                            <button onClick={triggerFileInput} className={clayButtonStyles}>
                                <div className="p-4 rounded-full bg-indigo-500/20 text-indigo-400">
                                    <Upload size={28} />
                                </div>
                                <span className="font-medium text-sm">Upload File</span>
                            </button>

                            {/* DEBUG ONLY: Fast trigger for testing Blueprint Overlay without OS File Picker */}
                            <button
                                onClick={() => {
                                    setImagePreview("https://placehold.co/400x600/1e293b/0ea5e9?text=MOCK+RECEIPT");
                                    startMockIngest();
                                }}
                                className="col-span-2 mt-4 p-3 bg-gray-800 rounded-xl text-teal-500 text-xs font-mono uppercase tracking-widest border border-gray-700 hover:bg-gray-700 transition"
                            >
                                [Debug] Simulate OCR Ingest
                            </button>

                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageCapture}
                            />
                        </motion.div>
                    ) : (
                        // --- POST-CAPTURE: BLUEPRINT OVERLAY ---
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
                                {isScanning && (
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
                                )}

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
                            {scanComplete && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="absolute bottom-8 left-0 right-0 flex justify-center px-6"
                                >
                                    <button
                                        onClick={resetCapture}
                                        className="w-full max-w-sm bg-gradient-to-r from-teal-500 to-indigo-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 active:scale-95 transition-transform"
                                    >
                                        Transmit to Studio <ArrowRight size={20} />
                                    </button>
                                </motion.div>
                            )}

                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
