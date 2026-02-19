import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, Lock, CheckCircle2 } from 'lucide-react';

interface ProtocolAuthProps {
    architectName: string;
    onAuthenticated: () => void;
}

export const ProtocolAuth = ({ architectName, onAuthenticated }: ProtocolAuthProps) => {
    const [scanning, setScanning] = useState(false);
    const [progress, setProgress] = useState(0);

    const startScan = () => {
        setScanning(true);
    };

    useEffect(() => {
        if (!scanning) return;

        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setTimeout(onAuthenticated, 1500); // Give time for the cinematic flash
                    return 100;
                }
                return prev + 2; // 50 steps * 20ms = 1000ms scan
            });
        }, 20);

        return () => clearInterval(interval);
    }, [scanning, onAuthenticated]);

    return (
        <div className="h-full flex flex-col items-center justify-center p-8 max-w-md mx-auto relative overflow-hidden">
            {/* Cinematic Flash on completion */}
            <AnimatePresence>
                {progress === 100 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 1, times: [0, 0.1, 1] }}
                        className="fixed inset-0 bg-[#00FF00] z-0 mix-blend-screen pointer-events-none"
                    />
                )}
            </AnimatePresence>

            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative cursor-pointer group z-10"
                onMouseDown={startScan}
                onTouchStart={startScan}
            >
                {/* Fingerprint Scanner Visual */}
                <div className={`w-64 h-64 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${progress === 100
                    ? 'border-[#00FF00] bg-[#00FF00]/20 shadow-[0_0_80px_rgba(0,255,0,0.8)] scale-110'
                    : scanning
                        ? 'border-[#00FF00]/50 shadow-[0_0_40px_rgba(0,255,0,0.3)]'
                        : 'border-[#00FF00]/20 bg-black'
                    }`}>
                    {progress === 100 ? (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 10 }}
                        >
                            <CheckCircle2 className="w-32 h-32 text-[#00FF00] drop-shadow-[0_0_20px_rgba(0,255,0,1)]" />
                        </motion.div>
                    ) : (
                        <Fingerprint className={`w-32 h-32 transition-colors duration-300 ${scanning ? 'text-[#00FF00] animate-pulse drop-shadow-[0_0_15px_rgba(0,255,0,0.8)]' : 'text-[#00FF00]/30 group-hover:text-[#00FF00]/70'
                            }`} />
                    )}
                </div>

                {/* Scanline */}
                {scanning && progress < 100 && (
                    <motion.div
                        className="absolute left-0 right-0 h-1 bg-[#00FF00] shadow-[0_0_20px_#00FF00] z-10"
                        style={{ top: `${progress}%` }}
                    />
                )}

                {/* Progress Ring */}
                <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                    <circle
                        cx="50" cy="50" r="48"
                        stroke="currentColor" strokeWidth="2" fill="none"
                        className="text-[#00FF00]/20"
                    />
                    <circle
                        cx="50" cy="50" r="48"
                        stroke="currentColor" strokeWidth="2" fill="none"
                        strokeDasharray="301.59"
                        strokeDashoffset={301.59 - (301.59 * progress) / 100}
                        className="text-[#FF00FF] transition-all duration-75 ease-linear drop-shadow-[0_0_10px_rgba(255,0,255,0.8)]"
                    />
                </svg>
            </motion.div>

            <motion.div
                className="mt-12 text-center space-y-2 z-10 relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <div className="flex items-center justify-center gap-2 text-[#FF00FF]/80 uppercase tracking-widest text-sm mb-2 drop-shadow-[0_0_5px_rgba(255,0,255,0.5)]">
                    <Lock className="w-4 h-4" />
                    Secure Biometric Gate
                </div>
                <h2 className="text-2xl font-bold text-[#00FF00] drop-shadow-[0_0_10px_rgba(0,255,0,0.8)]">
                    {progress === 100 ? 'SOVEREIGN NODE AUTHORIZED' : scanning ? 'DECRYPTING BIOMETRICS...' : 'AWAITING INPUT'}
                </h2>
                <p className="text-[#00FF00]/80 font-mono tracking-widest">
                    {architectName}
                </p>
                {!scanning && (
                    <p className="text-sm text-[#FF00FF] mt-4 animate-pulse uppercase tracking-widest drop-shadow-[0_0_8px_rgba(255,0,255,0.8)]">
                        [ Hold To Decrypt ]
                    </p>
                )}
            </motion.div>
        </div>
    );
};
