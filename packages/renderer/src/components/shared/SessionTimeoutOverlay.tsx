import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Unlock, ShieldAlert } from 'lucide-react';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export const SessionTimeoutOverlay: React.FC = () => {
    const [isIdle, setIsIdle] = useState(false);
    const [isUnlocking, setIsUnlocking] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const resetTimer = useCallback(() => {
        if (isIdle) return; // Don't track while already locked

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            setIsIdle(true);
        }, IDLE_TIMEOUT_MS);
    }, [isIdle]);

    useEffect(() => {
        // Initial setup
        resetTimer();

        // Listen for user activity
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

        const handleActivity = () => resetTimer();

        events.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            events.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });
        };
    }, [resetTimer]);

    const handleUnlock = () => {
        setIsUnlocking(true);
        // Simulate a brief verification delay
        setTimeout(() => {
            setIsIdle(false);
            setIsUnlocking(false);
            resetTimer();
        }, 800);
    };

    return (
        <AnimatePresence>
            {isIdle && (
                <motion.div
                    initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
                    animate={{ opacity: 1, backdropFilter: "blur(24px)" }}
                    exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.95, y: -10, opacity: 0 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className="bg-black/60 border border-white/10 rounded-[2.5rem] p-12 max-w-md w-full text-center shadow-2xl relative overflow-hidden"
                    >
                        {/* Ambient Glow */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-blue-500/20 blur-[60px] pointer-events-none rounded-full" />

                        <div className="relative z-10 flex flex-col items-center">
                            <motion.div
                                animate={isUnlocking ? { rotateY: 180 } : {}}
                                transition={{ duration: 0.6 }}
                                className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-6 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                            >
                                {isUnlocking ? <Unlock size={32} /> : <Lock size={32} />}
                            </motion.div>

                            <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Session Locked</h2>
                            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                                For your security, we've locked your session due to inactivity. All your unsaved work is preserved.
                            </p>

                            <button
                                onClick={handleUnlock}
                                disabled={isUnlocking}
                                className="w-full relative group overflow-hidden bg-white/5 border border-white/10 hover:border-blue-500/50 hover:bg-white/10 text-white rounded-2xl py-4 font-bold tracking-wider uppercase text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="absolute inset-0 bg-blue-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    {isUnlocking ? (
                                        <>
                                            <ShieldAlert size={16} className="animate-pulse" />
                                            Verifying...
                                        </>
                                    ) : (
                                        'Click to Resume'
                                    )}
                                </span>
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
