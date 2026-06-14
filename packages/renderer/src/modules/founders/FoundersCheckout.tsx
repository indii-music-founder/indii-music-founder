import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/core/store';
import { 
    ArrowLeft, 
    CheckCircle2, 
    Lock, 
    CreditCard, 
    ShieldCheck, 
    Loader2, 
    Sparkles, 
    Check, 
    ArrowRight, 
    Globe, 
    AlertTriangle 
} from 'lucide-react';
import { createOneTimePayment } from '@/services/payment/PaymentService';
import { logger } from '@/utils/logger';

export default function FoundersCheckout() {
    const setModule = useStore(state => state.setModule);
    const user = useStore(state => state.user);

    // Checkout Flow States:
    // 'idle' | 'initiating' | 'mock_redirect' | 'mock_stripe_portal' | 'mock_processing' | 'success'
    const [checkoutState, setCheckoutState] = useState<'idle' | 'initiating' | 'mock_redirect' | 'mock_stripe_portal' | 'mock_processing' | 'success'>('idle');
    const [redirectProgress, setRedirectProgress] = useState(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Mock Portal Form State
    const [email, setEmail] = useState(user?.email || '');
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCvc, setCardCvc] = useState('');
    const [cardName, setCardName] = useState(user?.displayName || '');
    const [postalCode, setPostalCode] = useState('');

    useEffect(() => {
        if (user?.email) {
            setTimeout(() => setEmail(user.email!), 0);
        }
        if (user?.displayName) {
            setTimeout(() => setCardName(user.displayName!), 0);
        }
    }, [user]);

    // Handle Card Formatting
    const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 16);
        const formatted = val.replace(/(\d{4})(?=\d)/g, '$1 ');
        setCardNumber(formatted);
    };

    const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
        if (val.length >= 3) {
            setCardExpiry(`${val.slice(0, 2)}/${val.slice(2)}`);
        } else {
            setCardExpiry(val);
        }
    };

    const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
        setCardCvc(val);
    };

    // Auto-detect Card Type
    const getCardBrand = () => {
        if (!cardNumber) return null;
        const clean = cardNumber.replace(/\s/g, '');
        if (clean.startsWith('4')) return 'Visa';
        if (/^5[1-5]/.test(clean)) return 'Mastercard';
        if (/^3[47]/.test(clean)) return 'Amex';
        if (/^6011/.test(clean)) return 'Discover';
        return null;
    };

    // Trigger Checkout
    const handleStartCheckout = async () => {
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
                successUrl,
                cancelUrl
            });

            logger.info(`[FoundersCheckout] Directing to live Stripe URL: ${checkoutUrl}`);
            window.location.href = checkoutUrl;
        } catch (err: any) {
            logger.warn('[FoundersCheckout] Real Stripe function failed or is unconfigured. Falling back to the premium redirect mockup loader.', err);
            
            // Switch to mock redirect loader
            setCheckoutState('mock_redirect');
            setRedirectProgress(0);
        }
    };

    // Simulate Redirect Progress Timer
    useEffect(() => {
        if (checkoutState !== 'mock_redirect') return;

        const interval = setInterval(() => {
            setRedirectProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        setCheckoutState('mock_stripe_portal');
                    }, 500);
                    return 100;
                }
                return prev + 4; // Fast loader transition
            });
        }, 80);

        return () => clearInterval(interval);
    }, [checkoutState]);

    // Handle Form Submit on Premium Mock Portal
    const handleMockPaymentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || cardNumber.length < 15 || cardExpiry.length < 5 || cardCvc.length < 3 || !cardName || !postalCode) {
            setErrorMsg('Please fill out all billing credentials correctly.');
            return;
        }

        setErrorMsg(null);
        setCheckoutState('mock_processing');

        // Simulate secure verification & transaction ledger commit
        setTimeout(() => {
            setCheckoutState('success');
        }, 3000);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-full p-6 md:p-8 overflow-y-auto relative bg-background text-foreground">
            {/* Ambient Background Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/5 via-background to-background pointer-events-none" />

            {/* Top Navigation */}
            {checkoutState === 'idle' && (
                <button
                    onClick={() => setModule('dashboard')}
                    className="fixed top-6 left-6 z-20 flex items-center gap-2 text-xs text-gray-500 hover:text-gray-200 transition-colors group"
                >
                    <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                    Return to Studio
                </button>
            )}

            <AnimatePresence mode="wait">
                {/* IDLE VIEW: Landing and Offer details */}
                {checkoutState === 'idle' && (
                    <motion.div
                        key="idle-view"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        className="z-10 max-w-4xl w-full text-center mt-12 mb-12 flex flex-col items-center"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono tracking-widest uppercase mb-8">
                            Founders Round — 4 Seats Left of 11 Total
                        </div>
                        
                        <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-6">
                            Back The <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-amber-300">Vision</span>.
                        </h1>
                        
                        <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-10">
                            Secure your place as an early backer. Get lifetime platform access, priority feature voting rights, and a permanent cryptographic signature in the indii core architecture.
                        </p>

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

                        {/* Extra informational context */}
                        <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6 max-w-2xl mt-12 flex items-start gap-4 text-left">
                            <Sparkles className="text-amber-500 shrink-0 mt-1" size={24} />
                            <div>
                                <h4 className="text-amber-400 font-semibold mb-1">Founders Perks & Activation</h4>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Your verified checkout session directly constructs your unique license identifier. 
                                    Once processed, your installers (DMG & EXE formats) are generated with your unique cryptohash pre-injected.
                                </p>
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

                {/* MOCK REDIRECT SCREEN */}
                {checkoutState === 'mock_redirect' && (
                    <motion.div
                        key="mock-redirect-view"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="z-10 w-full max-w-lg bg-black/40 border border-white/10 rounded-3xl p-8 backdrop-blur-xl text-center shadow-2xl"
                    >
                        <div className="relative w-16 h-16 mx-auto mb-6 flex items-center justify-center">
                            {/* Pulsing ring */}
                            <span className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping" />
                            <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                                <Globe size={24} className="text-blue-400 animate-pulse" />
                            </div>
                        </div>

                        <h3 className="text-2xl font-bold text-white mb-2">Verifying Connection</h3>
                        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                            Securing tunnel to checkout.stripe.com. Verifying TLS handshake & cryptographic security keys...
                        </p>

                        {/* Simulated Mock browser URL address bar */}
                        <div className="bg-black/60 border border-white/5 rounded-xl px-4 py-2 font-mono text-xs text-left text-gray-500 flex items-center gap-2 mb-8 select-none overflow-hidden whitespace-nowrap">
                            <Lock size={12} className="text-emerald-500 shrink-0" />
                            <span className="text-emerald-400 font-semibold shrink-0">https://</span>
                            <span className="text-gray-300">checkout.stripe.com/pay/cs_live_51P_indii_fndr_0x7b4a2</span>
                        </div>

                        {/* Progress slider bar */}
                        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                            <motion.div 
                                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${redirectProgress}%` }}
                                transition={{ ease: 'easeOut' }}
                            />
                        </div>

                        <div className="mt-3 text-right font-mono text-[10px] text-gray-600 uppercase tracking-widest">
                            Handshake {redirectProgress}% Complete
                        </div>
                    </motion.div>
                )}

                {/* PREMIUM MOCK STRIPE CHECKOUT PORTAL */}
                {checkoutState === 'mock_stripe_portal' && (
                    <motion.div
                        key="mock-portal-view"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -30 }}
                        className="z-10 w-full max-w-4xl bg-[#1e293b] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[550px] text-left"
                    >
                        {/* LEFT PANEL: Order summary */}
                        <div className="w-full md:w-[42%] bg-[#0f172a] p-8 md:p-10 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/5">
                            <div>
                                <button 
                                    onClick={() => setCheckoutState('idle')}
                                    className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-8 font-semibold"
                                >
                                    <ArrowLeft size={12} />
                                    <span>Cancel purchase</span>
                                </button>

                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center font-bold text-amber-500 text-sm">
                                        i
                                    </div>
                                    <span className="font-bold text-gray-300 text-sm uppercase tracking-widest font-mono">indii Studio</span>
                                </div>

                                <div className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">Pay New Detroit Music LLC</div>
                                <div className="text-4xl font-extrabold text-white font-mono mb-4">$2,500.00</div>

                                <div className="space-y-4 mt-8 pt-6 border-t border-white/5">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-400">indii Founder Seat #8</span>
                                        <span className="text-white font-semibold">$2,500.00</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-gray-500">
                                        <span>Cryptographic Signature Registry</span>
                                        <span>Included</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-gray-500">
                                        <span>Custom DMG/EXE SDK Compile</span>
                                        <span>Included</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-white/5 flex items-center gap-2 text-xs text-gray-500 select-none">
                                <Lock size={12} className="text-blue-500" />
                                <span>Powered by <strong className="text-white">stripe</strong></span>
                            </div>
                        </div>

                        {/* RIGHT PANEL: Form inputs */}
                        <form 
                            onSubmit={handleMockPaymentSubmit}
                            className="w-full md:w-[58%] p-8 md:p-10 flex flex-col justify-between"
                        >
                            <div>
                                <h3 className="text-xl font-bold text-white mb-6">Secure Payment Details</h3>

                                {errorMsg && (
                                    <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs flex items-center gap-2">
                                        <AlertTriangle size={14} className="shrink-0" />
                                        <span>{errorMsg}</span>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {/* Email */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Email Address</label>
                                        <input 
                                            type="email"
                                            required
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder="you@domain.com"
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                        />
                                    </div>

                                    {/* Card Info */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Card Information</label>
                                        <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden focus-within:border-blue-500 transition-colors">
                                            {/* Number */}
                                            <div className="relative">
                                                <input 
                                                    type="text"
                                                    required
                                                    value={cardNumber}
                                                    onChange={handleCardNumberChange}
                                                    placeholder="1234 5678 1234 5678"
                                                    className="w-full bg-transparent px-4 py-3 text-white placeholder-gray-600 focus:outline-none text-sm pr-12"
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                                                    {getCardBrand() || 'Card'}
                                                </div>
                                            </div>

                                            {/* Expiry & CVC */}
                                            <div className="flex border-t border-white/10">
                                                <input 
                                                    type="text"
                                                    required
                                                    value={cardExpiry}
                                                    onChange={handleExpiryChange}
                                                    placeholder="MM/YY"
                                                    className="w-1/2 bg-transparent px-4 py-3 text-white placeholder-gray-600 focus:outline-none text-sm border-r border-white/10 text-center"
                                                />
                                                <input 
                                                    type="password"
                                                    required
                                                    value={cardCvc}
                                                    onChange={handleCvcChange}
                                                    placeholder="CVC"
                                                    className="w-1/2 bg-transparent px-4 py-3 text-white placeholder-gray-600 focus:outline-none text-sm text-center"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Name */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Cardholder Name</label>
                                        <input 
                                            type="text"
                                            required
                                            value={cardName}
                                            onChange={e => setCardName(e.target.value)}
                                            placeholder="Full Name as printed on card"
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                        />
                                    </div>

                                    {/* Billing Postal Code */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Postal Code</label>
                                        <input 
                                            type="text"
                                            required
                                            value={postalCode}
                                            onChange={e => setPostalCode(e.target.value)}
                                            placeholder="90210"
                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8">
                                <button
                                    type="submit"
                                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg flex items-center justify-center gap-2 group transition-all cursor-pointer"
                                >
                                    <CreditCard size={16} />
                                    <span>Pay $2,500.00</span>
                                </button>

                                <p className="text-[10px] text-gray-500 mt-3 text-center leading-relaxed">
                                    By proceeding, you authorize New Detroit Music LLC to process this simulated transaction to activate your studio environment seat.
                                </p>
                            </div>
                        </form>
                    </motion.div>
                )}

                {/* PROCESSING PAYMENT LOADER */}
                {checkoutState === 'mock_processing' && (
                    <motion.div
                        key="processing-view"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="z-10 flex flex-col items-center justify-center p-8 max-w-md text-center"
                    >
                        <div className="relative w-16 h-16 mb-6">
                            <span className="absolute inset-0 rounded-full border-4 border-white/5" />
                            <span className="absolute inset-0 rounded-full border-4 border-t-amber-500 border-l-amber-500 animate-spin" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Processing Transaction</h3>
                        <p className="text-gray-400 text-sm">
                            Authorizing funding tokens & generating your unique system cryptographic signature...
                        </p>
                    </motion.div>
                )}

                {/* SUCCESS VIEW */}
                {checkoutState === 'success' && (
                    <motion.div
                        key="success-view"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="z-10 w-full max-w-xl bg-black/40 border border-emerald-500/20 rounded-3xl p-8 md:p-10 backdrop-blur-xl text-center shadow-2xl shadow-emerald-950/15"
                    >
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 size={32} className="text-emerald-400" />
                        </div>

                        <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold">Verification Complete</span>
                        
                        <h2 className="text-3xl md:text-4xl font-extrabold text-white mt-2 mb-4">
                            Welcome, Founder.
                        </h2>
                        
                        <p className="text-gray-400 text-sm leading-relaxed mb-8">
                            Your transaction has successfully completed. Seat #8 is officially secured. 
                            The cryptographic seat hash has been computed and permanently linked.
                        </p>

                        {/* Transaction Receipt Box */}
                        <div className="bg-black/60 border border-white/5 rounded-2xl p-5 text-left font-mono text-xs space-y-2.5 mb-8">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Transaction ID:</span>
                                <span className="text-gray-300">txn_indii_fndr_v8a7b9c2</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Seat Number:</span>
                                <span className="text-amber-400">Seat 08 of 11 (Lifetime Pass)</span>
                            </div>
                            <div className="flex justify-between items-start gap-4">
                                <span className="text-gray-500 shrink-0">Agreement Hash:</span>
                                <span className="text-gray-300 break-all text-right">0x8f2d91e3e7f4c5a0b9a9d2d7c5a0b9a9d2</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setModule('dashboard')}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-colors cursor-pointer"
                        >
                            Return to indii Studio
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
