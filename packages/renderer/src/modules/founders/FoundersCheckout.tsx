import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '@/core/store';
import {
    ArrowLeft,
    Lock,
    CreditCard,
    ShieldCheck,
    Loader2,
    Check,
    ArrowRight,
    AlertTriangle,
    Mail
} from 'lucide-react';
import { createOneTimePayment } from '@/services/payment/PaymentService';
import { logger } from '@/utils/logger';
import { flushFounderFunnelQueue, trackFounderFunnelEvent } from '@/services/founders/founderFunnel';

export default function FoundersCheckout() {
    const setModule = useStore(state => state.setModule);
    const user = useStore(state => state.user);

    // Checkout Flow States:
    // 'path-select' | 'agreement-review' | 'payment-option' | 'initiating'
    const [checkoutState, setCheckoutState] = useState<'path-select' | 'agreement-review' | 'payment-option' | 'initiating'>('path-select');
    const [selectedPath, setSelectedPath] = useState<'software-purchase' | 'founding-support' | null>(null);
    const [recognitionMessage, setRecognitionMessage] = useState('');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const hasTrackedCheckoutView = useRef(false);

    useEffect(() => {
        flushFounderFunnelQueue();
        if (checkoutState === 'path-select' && !hasTrackedCheckoutView.current) {
            hasTrackedCheckoutView.current = true;
            void trackFounderFunnelEvent('founder_checkout_viewed', {
                surface: 'founders_checkout',
                price: 2500,
            }, {
                userId: user?.uid ?? null,
                email: user?.email ?? null,
            });
        }
        if (checkoutState === 'agreement-review' && selectedPath) {
            void trackFounderFunnelEvent('founder_agreement_reviewed', {
                surface: 'founders_checkout',
                price: 2500,
                path: selectedPath,
            }, {
                userId: user?.uid ?? null,
                email: user?.email ?? null,
            });
        }
    }, [checkoutState, user, selectedPath]);

    // Trigger Checkout
    const handleStartCheckout = async () => {
        await trackFounderFunnelEvent('founder_pay_now_selected', {
            surface: 'founders_checkout',
            checkoutState,
            price: 2500,
        }, {
            userId: user?.uid || null,
            email: user?.email || null,
        });
        setCheckoutState('initiating');
        setErrorMsg(null);

        try {
            logger.info('[FoundersCheckout] Attempting to create a live Stripe Checkout session...');
            const successUrl = `${window.location.origin}/finance?payment=success&type=founder`;
            const cancelUrl = window.location.href;

            const checkoutUrl = await createOneTimePayment({
                userId: user?.uid || 'anonymous',
                customerEmail: user?.email || undefined,
                items: [{
                    name: 'indii Studio Founder Seat',
                    description: 'Lifetime Founder membership seat & custom installer builds.',
                    amount: 250000, // $2,500.00
                    quantity: 1
                }],
                // Routes the Stripe webhook to founder fulfillment (ISSUE-866)
                metadata: { type: 'founder_seat' },
                successUrl,
                cancelUrl
            });

            logger.info(`[FoundersCheckout] Directing to live Stripe URL: ${checkoutUrl}`);
            window.location.href = checkoutUrl;
        } catch (err: unknown) {
            logger.warn('[FoundersCheckout] Real Stripe checkout is unavailable.', err);
            setCheckoutState('payment-option');
            setErrorMsg('Stripe checkout is temporarily unavailable. Please try again or contact support.');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-full p-6 md:p-8 overflow-y-auto relative bg-background text-foreground">
            {/* Ambient Background Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/5 via-background to-background pointer-events-none" />

            {/* Top Navigation */}
            {(checkoutState === 'path-select' || checkoutState === 'agreement-review' || checkoutState === 'payment-option') && (
                <button
                    onClick={() => setModule('dashboard')}
                    className="fixed top-6 left-6 z-20 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-200 transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-lg px-1"
                >
                    <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                    Return to Studio
                </button>
            )}

            <AnimatePresence mode="wait">
                {/* PATH SELECT VIEW: Choose software vs support */}
                {checkoutState === 'path-select' && (
                    <motion.div
                        key="path-select-view"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        className="z-10 max-w-3xl w-full text-center mt-12 mb-12 flex flex-col items-center"
                    >
                        <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white mb-4">Secure Founder Access</h1>
                        <p className="text-gray-400 mb-12 max-w-xl">Choose how you'd like to participate in indii's launch:</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-8">
                            <button
                                onClick={() => { setSelectedPath('software-purchase'); setCheckoutState('agreement-review'); }}
                                className="p-6 rounded-2xl border-2 border-amber-500/20 hover:border-amber-500/60 bg-white/[0.02] hover:bg-amber-500/5 transition-all text-left group"
                            >
                                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-amber-300">Business Software Purchase</h3>
                                <p className="text-sm text-gray-400 mb-4">Acquire lifetime platform access as a business software expense.</p>
                                <div className="text-xs text-amber-300 font-mono">Tax-deductible software license</div>
                            </button>

                            <button
                                onClick={() => { setSelectedPath('founding-support'); setCheckoutState('agreement-review'); }}
                                className="p-6 rounded-2xl border-2 border-cyan-500/20 hover:border-cyan-500/60 bg-white/[0.02] hover:bg-cyan-500/5 transition-all text-left group"
                            >
                                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-300">Founding Support</h3>
                                <p className="text-sm text-gray-400 mb-4">Support indii's mission and receive full platform access and founder benefits.</p>
                                <div className="text-xs text-cyan-300 font-mono">Founder commitment & support</div>
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* AGREEMENT REVIEW VIEW */}
                {checkoutState === 'agreement-review' && (
                    <motion.div
                        key="agreement-view"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        className="z-10 max-w-3xl w-full text-center mt-8 mb-12 flex flex-col items-center"
                    >
                        <button onClick={() => setCheckoutState('path-select')} className="mb-4 text-sm text-gray-400 hover:text-white flex items-center gap-1">
                            <ArrowLeft size={14} /> Change Path
                        </button>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            {selectedPath === 'software-purchase' ? 'Founder Software Access Agreement' : 'Founding Support Agreement'}
                        </h2>
                        <p className="text-xs text-gray-500 mb-6">{selectedPath === 'software-purchase' ? 'Software Purchase Agreement' : 'Founding Support Agreement'}</p>

                        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-6 max-h-96 overflow-y-auto mb-6 text-left text-sm text-gray-300 w-full">
                            <p className="mb-4 font-semibold">AGREEMENT TERMS</p>
                            <p className="mb-3">This agreement grants you:</p>
                            <ul className="list-disc list-inside space-y-2 mb-4 text-xs">
                                <li>Lifetime full-platform access to indii Studio</li>
                                <li>All current and future founder-level modules and features</li>
                                <li>Boardroom and Conductor access for agent orchestration</li>
                                <li>Guided onboarding and beta participation status</li>
                                <li>Permanent founder recognition in the indii platform</li>
                                <li>Desktop application installers (macOS DMG, Windows EXE)</li>
                                <li>Future founder-level updates and priority feature voting</li>
                            </ul>
                            <p className="text-xs text-gray-500">
                                {selectedPath === 'software-purchase'
                                    ? 'Tax Disclaimer: If you use indii for your music business, this purchase may qualify as a deductible software expense. Please confirm with your tax professional.'
                                    : 'This commitment supports indii\'s development and launch.'}
                            </p>
                        </div>

                        <div className="mb-6 w-full">
                            <label className="text-xs font-semibold text-gray-400 mb-2 block">Founder Recognition Message (Optional)</label>
                            <textarea
                                value={recognitionMessage}
                                onChange={(e) => setRecognitionMessage(e.target.value)}
                                placeholder="Your name, business name, pseudonym, or dedication message..."
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-gray-600 focus:border-amber-500 focus:outline-none"
                                maxLength={200}
                                rows={3}
                            />
                            <p className="text-xs text-gray-500 mt-1">Your message will be recorded as part of indii's permanent founder recognition.</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 w-full">
                            <button
                                onClick={() => setCheckoutState('payment-option')}
                                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
                            >
                                <CreditCard size={16} className="inline mr-2" />
                                Proceed to Payment
                            </button>
                            <button
                                onClick={() => {
                                    void trackFounderFunnelEvent('founder_talk_first_selected', { path: selectedPath });
                                    window.location.href = 'mailto:wiil@indii.music?subject=indii%20Founder%20Access%20-%20Talk%20First';
                                }}
                                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-6 rounded-lg transition-all border border-white/20"
                            >
                                <Mail size={16} className="inline mr-2" />
                                Talk First: wiil@indii.music
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* PAYMENT OPTION VIEW (was IDLE VIEW) */}
                {checkoutState === 'payment-option' && (
                    <motion.div
                        key="payment-view"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        className="z-10 max-w-4xl w-full text-center mt-12 mb-12 flex flex-col items-center"
                    >
                        <button onClick={() => setCheckoutState('agreement-review')} className="mb-4 text-sm text-gray-400 hover:text-white flex items-center gap-1">
                            <ArrowLeft size={14} /> Back to Agreement
                        </button>

                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-mono tracking-widest uppercase mb-8">
                            Founder Access — ${2500}
                        </div>

                        <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-6">
                            Complete Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-amber-300">Access</span>.
                        </h1>

                        <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-10">
                            {selectedPath === 'software-purchase'
                                ? 'Pay securely via Stripe. Your Founder seat is activated within 24 hours of payment — you\'ll receive your seat number and permanent agreement hash.'
                                : 'Support indii\'s launch and receive full platform access.'}
                        </p>

                        {errorMsg && (
                            <div className="w-full max-w-2xl mb-6 bg-red-500/10 border border-red-500/20 text-red-300 p-4 rounded-xl text-sm flex items-start gap-2">
                                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        {/* Premium Pricing & Checkout Board */}
                        <div className="w-full max-w-2xl bg-white/[0.02] border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-md relative overflow-hidden group hover:border-amber-500/20 transition-all shadow-2xl shadow-amber-950/10">
                            {/* Glow Accent */}
                            <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-6 border-b border-white/5">
                                <div className="text-left">
                                    <span className="text-xs font-mono uppercase tracking-wider text-amber-400">Lifetime Seat Membership</span>
                                    <h3 className="text-2xl font-bold text-white mt-1">indii Founder Pass</h3>
                                    <p className="text-gray-400 text-sm mt-1">Single payment. Infinite utility.</p>
                                </div>
                                <div className="text-left md:text-right">
                                    <div className="text-3xl md:text-4xl font-extrabold text-white font-mono">$2,500.00</div>
                                    <div className="text-xs text-gray-500 uppercase tracking-widest font-mono mt-1">USD One-Time</div>
                                </div>
                            </div>

                            {/* Bullet points */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left mb-8">
                                <div className="flex items-start gap-3">
                                    <Check className="text-amber-500 mt-1 shrink-0" size={16} />
                                    <span className="text-gray-300 text-sm">Lifetime Pro Studio membership</span>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Check className="text-amber-500 mt-1 shrink-0" size={16} />
                                    <span className="text-gray-300 text-sm">Cryptographic agreement verification</span>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Check className="text-amber-500 mt-1 shrink-0" size={16} />
                                    <span className="text-gray-300 text-sm">Priority VIP agent dispatch quotas</span>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Check className="text-amber-500 mt-1 shrink-0" size={16} />
                                    <span className="text-gray-300 text-sm">Custom Mac / Windows distribution builds</span>
                                </div>
                            </div>

                            {/* Secure Checkout Button */}
                            <button
                                onClick={handleStartCheckout}
                                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg shadow-orange-950/20 flex items-center justify-center gap-3 group transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                            >
                                <Lock size={18} className="text-white/80 group-hover:scale-110 transition-transform" />
                                <span>Proceed to Secure Stripe Checkout</span>
                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </button>

                            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500 font-mono">
                                <ShieldCheck size={14} className="text-amber-500/80" />
                                <span>Guaranteed Secure via Stripe SSL Protocol</span>
                            </div>
                        </div>

                    </motion.div>
                )}

                {/* INITIATING LOADER: Real Stripe checkout request */}
                {checkoutState === 'initiating' && (
                    <motion.div
                        key="initiating-view"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="z-10 flex flex-col items-center justify-center p-8 max-w-md text-center"
                    >
                        <Loader2 size={48} className="animate-spin text-amber-500 mb-6" />
                        <h3 className="text-xl font-bold text-white mb-2">Connecting to Stripe</h3>
                        <p className="text-gray-400 text-sm">
                            Opening secure encryption tunnel to Stripe servers...
                        </p>
                    </motion.div>
                )}

            </AnimatePresence>
        </div>
    );
}
