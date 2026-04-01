import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useStore } from '@/core/store';
import { createOneTimePayment } from '@/services/payment/PaymentService';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { logger } from '@/utils/logger';

interface ActivateResult {
    seat: number;
    message: string;
    covenantHash: string;
}

export default function FoundersCheckout() {
    const user = useStore(state => state.user);
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const paymentStatus = searchParams.get('payment'); // 'success' or 'cancelled'

    const [displayName, setDisplayName] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [activationResult, setActivationResult] = useState<ActivateResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Initial state: User clicks to purchase.
    const handleCheckout = async () => {
        if (!user) return;
        setIsProcessing(true);
        setError(null);
        try {
            const url = await createOneTimePayment({
                userId: user.uid,
                items: [{
                    name: 'indiiOS Genesis Covenant',
                    description: 'Founders Round Genesis Seed (Permanently encoded in the codebase)',
                    amount: 250000,
                    quantity: 1,
                }],
                successUrl: `${window.location.origin}/founders-checkout?payment=success&session_id={CHECKOUT_SESSION_ID}`,
                cancelUrl: `${window.location.origin}/founders-checkout?payment=cancelled`,
                metadata: { type: 'founder_pass' }
            });
            window.location.href = url;
        } catch (err: unknown) {
            const error = err as Error;
            logger.error('Checkout failed', error);
            setError(error.message || 'Failed to initiate checkout.');
            setIsProcessing(false);
        }
    };

    const handleActivate = async () => {
        if (!user || !sessionId || !displayName.trim()) return;
        setIsProcessing(true);
        setError(null);

        try {
            const functions = getFunctions();
            // In a real staging environment, this is where we call the Cloud Function
            const activateFn = httpsCallable(functions, 'activateFounderPass');
            const res = await activateFn({
                userId: user.uid,
                sessionId,
                displayName: displayName.trim()
            });
            setActivationResult(res.data as ActivateResult);

            // Reload user profile in store to pick up FOUNDER tier
            await useStore.getState().loadUserProfile(user.uid);
        } catch (err: unknown) {
            const error = err as Error;
            logger.error('Activation failed', error);
            setError(error.message || 'Failed to activate founders pass.');
        } finally {
            setIsProcessing(false);
        }
    };

    // View 3: Complete
    if (activationResult) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-purple-900/10 pointer-events-none" />
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="z-10 bg-black/60 backdrop-blur-xl border border-amber-500/30 p-12 rounded-[3rem] max-w-xl text-center shadow-[0_0_100px_rgba(245,158,11,0.1)]">
                    <h2 className="text-4xl font-black tracking-tighter text-white mb-2">Welcome to the Inner Circle, Founder <span className="text-amber-400">#{activationResult.seat}</span></h2>
                    <p className="text-gray-300 mb-8 leading-relaxed max-w-sm mx-auto">{activationResult.message}</p>

                    <div className="bg-black/80 rounded-2xl border border-white/5 overflow-hidden">
                        <div className="bg-white/5 py-2 px-4 border-b border-white/5 flex gap-2 items-center">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-[10px] text-gray-500 font-mono ml-2 uppercase tracking-widest">Covenant Hash</span>
                        </div>
                        <div className="p-4 text-left font-mono text-[11px] text-amber-500/80 break-all select-all">
                            {activationResult.covenantHash}
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    // View 2: Post-checkout (Sign the Covenant)
    if (paymentStatus === 'success' && sessionId) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 max-w-2xl mx-auto">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
                    <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-4 text-center">
                        Cement Your <span className="text-amber-400">Legacy</span>.
                    </h1>
                    <p className="text-gray-400 mb-12 text-center text-lg max-w-md mx-auto leading-relaxed">
                        Investment verified. Enter the name you want etched into the foundation of indiiOS. This string, plus the timestamp, will be cryptographically hashed and permanently committed to the codebase.
                    </p>

                    {error && (
                        <div className="text-red-400 bg-red-400/10 border border-red-400/20 p-4 rounded-xl w-full mb-6 text-sm flex items-center gap-3">
                            <span className="text-xl">⚠️</span> {error}
                        </div>
                    )}

                    <div className="bg-white/[0.02] border border-white/10 p-8 rounded-[2rem] w-full max-w-md mx-auto relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
                        <label className="block text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Public Name</label>
                        <input
                            type="text"
                            placeholder="e.g. Satoshi Nakamoto"
                            className="w-full p-4 rounded-xl bg-black/50 border border-white/10 text-white mb-6 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all"
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            maxLength={64}
                        />

                        <button
                            onClick={handleActivate}
                            disabled={isProcessing || !displayName.trim()}
                            className="w-full py-4 bg-amber-500 text-black font-black rounded-xl hover:bg-amber-400 disabled:opacity-50 disabled:bg-gray-700 disabled:text-gray-400 transition-all flex items-center justify-center gap-2"
                        >
                            {isProcessing ? 'Encoding to chain...' : 'Encode My Covenant'}
                            {!isProcessing && <span>→</span>}
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    // View 1: Pre-checkout
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900/10 via-background to-background pointer-events-none" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="z-10 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono tracking-widest uppercase mb-8">
                    Founders Round
                </div>
                <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6">
                    Back The <span className="text-amber-400">Vision</span>.
                </h1>

                {paymentStatus === 'cancelled' && (
                    <div className="inline-block text-amber-400 bg-amber-400/10 border border-amber-400/20 px-6 py-3 rounded-xl mb-8 text-sm font-medium">
                        Checkout was cancelled. The seat remains available.
                    </div>
                )}
                {error && (
                    <div className="mx-auto max-w-sm text-red-400/90 bg-red-400/10 border border-red-400/20 px-6 py-3 rounded-xl mb-8 text-sm font-medium">
                        {error === 'internal'
                            ? "The secure payment gateway is currently offline or provisioning. Please try again later."
                            : error}
                    </div>
                )}

                <button
                    onClick={handleCheckout}
                    disabled={isProcessing}
                    className="group relative overflow-hidden px-10 py-5 bg-amber-500 hover:bg-amber-400 text-black font-black text-lg rounded-2xl transition-all shadow-[0_0_60px_rgba(245,158,11,0.2)] hover:shadow-[0_0_80px_rgba(245,158,11,0.4)] disabled:opacity-50"
                >
                    {isProcessing ? 'Connecting secured channel...' : 'Support The Vision ($2,500)'}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                </button>
                <p className="mt-8 text-gray-400 text-sm max-w-sm mx-auto leading-relaxed">
                    Genesis investment guarantees lifetime access and <span className="text-amber-500/80">permanently acts as a credited basis</span> toward any future investment rounds.
                </p>
            </motion.div>
        </div>
    );
}
