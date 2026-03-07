/**
 * DropCampaignWizard — Item 125 (PRODUCTION_200)
 * 3-step limited drop campaign builder: products → countdown → audience.
 * Countdown timer preview, pre-sale + superfan-only gate toggles.
 */
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, ChevronRight, ChevronLeft, Zap, Clock, Users, CheckCircle2, Flame, Lock } from 'lucide-react';
import { MerchProduct } from '../types';

interface DropCampaignWizardProps {
    isOpen: boolean;
    onClose: () => void;
    products: MerchProduct[];
}

type Step = 1 | 2 | 3;

interface DropConfig {
    selectedProducts: string[];
    dropName: string;
    dropDate: string;
    dropTime: string;
    presaleEnabled: boolean;
    superfanOnly: boolean;
    countdownMessage: string;
}

function useCountdown(targetDate: string, targetTime: string) {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        if (!targetDate || !targetTime) return;
        const target = new Date(`${targetDate}T${targetTime}`).getTime();
        const tick = () => {
            const now = Date.now();
            const diff = Math.max(0, target - now);
            setTimeLeft({
                days: Math.floor(diff / 86400000),
                hours: Math.floor((diff % 86400000) / 3600000),
                minutes: Math.floor((diff % 3600000) / 60000),
                seconds: Math.floor((diff % 60000) / 1000),
            });
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [targetDate, targetTime]);

    return timeLeft;
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
    return (
        <div className="flex flex-col items-center">
            <div className="w-14 h-14 bg-black border border-[#FFE135]/30 rounded-xl flex items-center justify-center text-2xl font-black text-[#FFE135] shadow-[0_0_15px_rgba(255,225,53,0.15)]">
                {String(value).padStart(2, '0')}
            </div>
            <span className="text-[9px] text-neutral-600 uppercase tracking-widest mt-1 font-bold">{label}</span>
        </div>
    );
}

export function DropCampaignWizard({ isOpen, onClose, products }: DropCampaignWizardProps) {
    const [step, setStep] = useState<Step>(1);
    const [submitted, setSubmitted] = useState(false);
    const [config, setConfig] = useState<DropConfig>({
        selectedProducts: [],
        dropName: '',
        dropDate: '',
        dropTime: '20:00',
        presaleEnabled: false,
        superfanOnly: false,
        countdownMessage: '🔥 Limited drop dropping soon. Be ready.',
    });

    const countdown = useCountdown(config.dropDate, config.dropTime);

    const handleSubmit = async () => {
        await new Promise(r => setTimeout(r, 1500));
        setSubmitted(true);
    };

    const toggleProduct = (id: string) => {
        setConfig(prev => ({
            ...prev,
            selectedProducts: prev.selectedProducts.includes(id)
                ? prev.selectedProducts.filter(p => p !== id)
                : [...prev.selectedProducts, id],
        }));
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) { onClose(); setStep(1); setSubmitted(false); } }}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[#FFE135]/20 border border-[#FFE135]/30 flex items-center justify-center">
                                    <Flame size={14} className="text-[#FFE135]" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Limited Drop Campaign</h3>
                                    {!submitted && <p className="text-[10px] text-neutral-500">Step {step} of 3</p>}
                                </div>
                            </div>
                            <button onClick={() => { onClose(); setStep(1); setSubmitted(false); }} className="text-neutral-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Progress */}
                        {!submitted && (
                            <div className="flex gap-1 px-6 py-3 border-b border-white/5">
                                {([1, 2, 3] as Step[]).map(s => (
                                    <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-[#FFE135]' : 'bg-white/10'}`} />
                                ))}
                            </div>
                        )}

                        {/* Content */}
                        <div className="p-6 min-h-[320px]">
                            <AnimatePresence mode="wait">
                                {submitted ? (
                                    <motion.div
                                        key="success"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex flex-col items-center justify-center h-64 gap-4"
                                    >
                                        <div className="w-16 h-16 rounded-full bg-[#FFE135]/20 border border-[#FFE135]/30 flex items-center justify-center">
                                            <CheckCircle2 size={28} className="text-[#FFE135]" />
                                        </div>
                                        <h3 className="text-xl font-black text-white">Drop Scheduled!</h3>
                                        <p className="text-sm text-neutral-400 text-center max-w-xs">
                                            <span className="text-white font-bold">{config.dropName || 'Your drop'}</span> is live. Fans will be notified when the countdown hits zero.
                                        </p>
                                    </motion.div>
                                ) : step === 1 ? (
                                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                        <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                            <Zap size={14} className="text-[#FFE135]" /> Select Products for Drop
                                        </h4>
                                        <div className="space-y-2 max-h-64 overflow-y-auto no-scrollbar">
                                            {products.length > 0 ? products.map(p => (
                                                <label key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${config.selectedProducts.includes(p.id) ? 'bg-[#FFE135]/5 border-[#FFE135]/30' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}>
                                                    <input type="checkbox" checked={config.selectedProducts.includes(p.id)} onChange={() => toggleProduct(p.id)} className="accent-[#FFE135]" />
                                                    <span className="text-sm text-white font-medium flex-1">{p.title || 'Product'}</span>
                                                    <span className="text-xs text-neutral-500">{p.price}</span>
                                                </label>
                                            )) : (
                                                <div className="py-12 text-center text-neutral-600 text-sm">No products found. Add products first.</div>
                                            )}
                                        </div>
                                    </motion.div>
                                ) : step === 2 ? (
                                    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                                        <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                            <Clock size={14} className="text-[#FFE135]" /> Set the Countdown
                                        </h4>
                                        <input
                                            type="text"
                                            placeholder="Drop name (e.g. 'Summer Collection')"
                                            value={config.dropName}
                                            onChange={e => setConfig(prev => ({ ...prev, dropName: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#FFE135]/40"
                                        />
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold mb-1 block">Drop Date</label>
                                                <input
                                                    type="date"
                                                    value={config.dropDate}
                                                    onChange={e => setConfig(prev => ({ ...prev, dropDate: e.target.value }))}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE135]/40"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold mb-1 block">Drop Time</label>
                                                <input
                                                    type="time"
                                                    value={config.dropTime}
                                                    onChange={e => setConfig(prev => ({ ...prev, dropTime: e.target.value }))}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFE135]/40"
                                                />
                                            </div>
                                        </div>

                                        {/* Live Countdown Preview */}
                                        {config.dropDate && (
                                            <div className="flex items-center justify-center gap-3 py-4">
                                                <CountdownUnit value={countdown.days} label="Days" />
                                                <span className="text-2xl font-black text-[#FFE135] mb-4">:</span>
                                                <CountdownUnit value={countdown.hours} label="Hrs" />
                                                <span className="text-2xl font-black text-[#FFE135] mb-4">:</span>
                                                <CountdownUnit value={countdown.minutes} label="Min" />
                                                <span className="text-2xl font-black text-[#FFE135] mb-4">:</span>
                                                <CountdownUnit value={countdown.seconds} label="Sec" />
                                            </div>
                                        )}
                                    </motion.div>
                                ) : (
                                    <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                                        <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                            <Users size={14} className="text-[#FFE135]" /> Choose Your Audience
                                        </h4>
                                        <label className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl cursor-pointer hover:border-white/10 transition-all">
                                            <div>
                                                <div className="text-sm font-bold text-white mb-0.5">Enable Pre-Sale</div>
                                                <div className="text-[11px] text-neutral-500">Allow early-access purchases before the official drop</div>
                                            </div>
                                            <input type="checkbox" checked={config.presaleEnabled} onChange={e => setConfig(prev => ({ ...prev, presaleEnabled: e.target.checked }))} className="accent-[#FFE135] w-4 h-4" />
                                        </label>
                                        <label className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border ${config.superfanOnly ? 'bg-amber-400/5 border-amber-400/30' : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}>
                                            <div className="flex items-start gap-3">
                                                <Lock size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <div className="text-sm font-bold text-white mb-0.5">Superfan Only</div>
                                                    <div className="text-[11px] text-neutral-500">Gate access to Superfan tier fans only (Crown holders)</div>
                                                </div>
                                            </div>
                                            <input type="checkbox" checked={config.superfanOnly} onChange={e => setConfig(prev => ({ ...prev, superfanOnly: e.target.checked }))} className="accent-[#FFE135] w-4 h-4" />
                                        </label>
                                        <textarea
                                            value={config.countdownMessage}
                                            onChange={e => setConfig(prev => ({ ...prev, countdownMessage: e.target.value }))}
                                            rows={2}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-[#FFE135]/40 resize-none"
                                            placeholder="Teaser message for fans..."
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        {!submitted && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
                                <button
                                    onClick={() => setStep(s => Math.max(1, s - 1) as Step)}
                                    disabled={step === 1}
                                    className="flex items-center gap-2 px-4 py-2 text-neutral-400 hover:text-white text-xs font-bold transition-colors disabled:opacity-30"
                                >
                                    <ChevronLeft size={14} /> Back
                                </button>
                                {step < 3 ? (
                                    <button
                                        onClick={() => setStep(s => Math.min(3, s + 1) as Step)}
                                        disabled={step === 1 && config.selectedProducts.length === 0}
                                        className="flex items-center gap-2 px-5 py-2 bg-[#FFE135] text-black rounded-lg text-xs font-bold hover:bg-[#FFD700] transition-all disabled:opacity-40"
                                    >
                                        Next <ChevronRight size={14} />
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSubmit}
                                        className="flex items-center gap-2 px-5 py-2 bg-[#FFE135] text-black rounded-lg text-xs font-bold hover:bg-[#FFD700] transition-all"
                                    >
                                        <Flame size={14} /> Launch Drop
                                    </button>
                                )}
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
