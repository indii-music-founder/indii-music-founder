import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
                    setTimeout(onAuthenticated, 800);
                    return 100;
                }
                return prev + 2; // 50 steps * 20ms = 1000ms scan
            });
        }, 20);

        return () => clearInterval(interval);
    }, [scanning, onAuthenticated]);

    return (
        <div className="h-full flex flex-col items-center justify-center p-8 max-w-md mx-auto relative">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative cursor-pointer group"
                onMouseDown={startScan}
                onTouchStart={startScan}
            >
                {/* Fingerprint Scanner Visual */}
                <div className={`w-64 h-64 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${progress === 100
                        ? 'border-green-500 bg-green-500/10 shadow-[0_0_50px_rgba(0,255,0,0.5)]'
                        : scanning
                            ? 'border-green-500/50 shadow-[0_0_30px_rgba(0,255,0,0.2)]'
                            : 'border-green-900 bg-black'
                    }`}>
                    {progress === 100 ? (
                        <CheckCircle2 className="w-32 h-32 text-green-500" />
                    ) : (
                        <Fingerprint className={`w-32 h-32 transition-colors duration-300 ${scanning ? 'text-green-400 animate-pulse' : 'text-green-900 group-hover:text-green-700'
                            }`} />
                    )}
                </div>

                {/* Scanline */}
                {scanning && progress < 100 && (
                    <motion.div
                        className="absolute left-0 right-0 h-1 bg-green-500 shadow-[0_0_10px_#0f0] z-10"
                        style={{ top: `${progress}%` }}
                    />
                )}

                {/* Progress Ring */}
                <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                    <circle
                        cx="50" cy="50" r="48"
                        stroke="currentColor" strokeWidth="2" fill="none"
                        className="text-green-900/30"
                    />
                    <circle
                        cx="50" cy="50" r="48"
                        stroke="currentColor" strokeWidth="2" fill="none"
                        strokeDasharray="301.59"
                        strokeDashoffset={301.59 - (301.59 * progress) / 100}
                        className="text-green-500 transition-all duration-75 ease-linear"
                    />
                </svg>
            </motion.div>

            <motion.div
                className="mt-12 text-center space-y-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                <div className="flex items-center justify-center gap-2 text-green-500/60 uppercase tracking-widest text-sm mb-2">
                    <Lock className="w-4 h-4" />
                    Secure Biometric Gate
                </div>
                <h2 className="text-2xl font-bold text-green-400">
                    {progress === 100 ? 'IDENTITY VERIFIED' : scanning ? 'VERIFYING BIOMETRICS...' : 'AWAITING INPUT'}
                </h2>
                <p className="text-green-600 font-mono">
                    {architectName}
                </p>
                {!scanning && (
                    <p className="text-sm text-green-700 mt-4 animate-pulse">
                        [ HOLD TO SCAN ]
                    </p>
                )}
            </motion.div>
        </div>
    );
};
