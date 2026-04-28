import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/core/store';
import { Download, Monitor, Apple, ArrowLeft, Loader2, Key } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';

export default function FoundersPortal() {
    const { userProfile, setModule } = useStore(state => ({
        userProfile: state.userProfile,
        setModule: state.setModule
    }));

    const [isMacLoading, setIsMacLoading] = useState(false);
    const [isWinLoading, setIsWinLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isFounder = userProfile?.subscriptionTier === 'founder' || userProfile?.tier === 'founder' || userProfile?.isFounder === true;

    const handleDownload = async (platform: 'mac' | 'windows') => {
        if (platform === 'mac') setIsMacLoading(true);
        else setIsWinLoading(true);
        setError(null);

        try {
            const generateDownloadUrl = httpsCallable(functions, 'generateReleaseDownloadUrl');
            const result = await generateDownloadUrl({ platform });
            const data = result.data as { success: boolean; url?: string; message?: string };

            if (data.success && data.url) {
                // Trigger download
                window.location.href = data.url;
            } else {
                setError(data.message || 'Failed to generate download link.');
            }
        } catch (err) {
            console.error('Download error:', err);
            setError(err instanceof Error ? err.message : 'An error occurred while preparing the download.');
        } finally {
            if (platform === 'mac') setIsMacLoading(false);
            else setIsWinLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full p-8 overflow-y-auto relative bg-background text-foreground">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900/10 via-background to-background pointer-events-none" />

            <button
                onClick={() => setModule('dashboard')}
                className="fixed top-6 left-6 z-20 flex items-center gap-2 text-xs text-gray-500 hover:text-gray-200 transition-colors group"
            >
                <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                Return to Studio
            </button>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="z-10 max-w-4xl w-full text-center mt-12"
            >
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono tracking-widest uppercase mb-8">
                    <Key size={14} /> Founder Exclusive Access
                </div>

                <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-6">
                    Download <span className="text-amber-400">indiiOS</span>.
                </h1>

                {!isFounder ? (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 max-w-2xl mx-auto text-center mt-8">
                        <h2 className="text-xl font-bold text-red-400 mb-4">Access Denied</h2>
                        <p className="text-gray-300 text-sm leading-relaxed mb-6">
                            Your account is not currently verified as a Founder. 
                            The Desktop Application is strictly restricted to early backers during the Alpha phase.
                        </p>
                        <button
                            onClick={() => setModule('founders-checkout')}
                            className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-6 py-3 rounded-lg text-sm font-semibold transition-colors"
                        >
                            Become a Founder
                        </button>
                    </div>
                ) : (
                    <>
                        <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed mb-16">
                            Welcome back. Download the latest builds for your operating system. These installers are exclusively available to verified Founders.
                        </p>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm mb-8 max-w-2xl mx-auto">
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto text-left mb-16">
                            {/* Mac Download */}
                            <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 hover:border-amber-500/30 transition-colors relative overflow-hidden group flex flex-col">
                                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all pointer-events-none">
                                    <Apple size={80} className="text-amber-500" />
                                </div>
                                <div className="w-12 h-12 bg-white/5 text-white rounded-xl flex items-center justify-center mb-6">
                                    <Apple size={24} />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">macOS</h3>
                                <p className="text-gray-400 text-sm mb-8 flex-1">Apple Silicon (M1/M2/M3) and Intel Macs.</p>
                                
                                <button
                                    onClick={() => handleDownload('mac')}
                                    disabled={isMacLoading || isWinLoading}
                                    className="w-full flex items-center justify-center gap-3 bg-amber-500 text-black font-bold py-4 rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-50"
                                >
                                    {isMacLoading ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <Download size={18} />
                                    )}
                                    Download .dmg
                                </button>
                            </div>

                            {/* Windows Download */}
                            <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 hover:border-amber-500/30 transition-colors relative overflow-hidden group flex flex-col">
                                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all pointer-events-none">
                                    <Monitor size={80} className="text-amber-500" />
                                </div>
                                <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center mb-6">
                                    <Monitor size={24} />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">Windows</h3>
                                <p className="text-gray-400 text-sm mb-8 flex-1">Windows 10 / 11 (64-bit).</p>
                                
                                <button
                                    onClick={() => handleDownload('windows')}
                                    disabled={isMacLoading || isWinLoading}
                                    className="w-full flex items-center justify-center gap-3 bg-white/10 text-white font-bold py-4 rounded-xl hover:bg-white/20 transition-colors disabled:opacity-50"
                                >
                                    {isWinLoading ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <Download size={18} />
                                    )}
                                    Download .exe
                                </button>
                            </div>
                        </div>

                        <p className="mt-8 text-gray-500 text-xs font-mono">
                            By downloading indiiOS, you agree to the Founders Agreement and Alpha Testing terms.
                        </p>
                    </>
                )}
            </motion.div>
        </div>
    );
}
