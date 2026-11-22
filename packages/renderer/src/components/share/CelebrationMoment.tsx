/**
 * CelebrationMoment — an awaited, full-screen "you did it" beat for real
 * milestones, ending in the branded ShareSheet.
 *
 *   if (claimMilestone('first-release-delivered', uid)) {
 *       void CelebrationMoment.call({ headline, detail, template, options });
 *   }
 *
 * Mount `<CelebrationMoment />` once next to `<ShareSheet />`.
 */
import { createCallable } from 'react-call';
import { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Share2, Volume2, VolumeX } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { SIGNATURE_BUTTON_BASE, SIGNATURE_BUTTON_TONES } from '@shared/share/signatureButton';
import { FREQUENCY_PALETTE, type ShareCardOptions, type ShareCardTemplate } from '@shared/share/shareCardTemplates';
import { ShareSheet } from './ShareSheet';
import { isMilestoneSoundEnabled, playSonicLogo, setMilestoneSoundEnabled } from '@/services/share/milestones';
import { burstConfetti } from '@/services/moments/confetti';
import { useStore } from '@/core/store';
import type { ModuleId } from '@/core/constants';

export interface CelebrationNextStep {
    label: string;
    moduleId: ModuleId;
}

export interface CelebrationMomentProps {
    eyebrow?: string;
    headline: string;
    detail?: string;
    /** Card the "Share it" button opens in the ShareSheet. */
    template: ShareCardTemplate;
    options?: ShareCardOptions;
    /** Actionable "Now what?" links that route to the next studio module. */
    nextSteps?: CelebrationNextStep[];
}

export type CelebrationResult = 'shared' | 'dismissed';

const indigo = SIGNATURE_BUTTON_TONES.indigo;

function SignatureDisc({ still }: { still: boolean }) {
    const rings = Array.from({ length: 14 }, (_, i) => 92 - i * 4.6);
    return (
        <motion.svg
            viewBox="0 0 200 200"
            className="h-40 w-40 drop-shadow-[0_0_40px_rgba(254,46,154,0.45)] sm:h-48 sm:w-48"
            aria-hidden="true"
            initial={still ? false : { scale: 0.6, opacity: 0, rotate: -90 }}
            animate={still ? undefined : { scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        >
            <defs>
                <linearGradient id="celebration-disc" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor={FREQUENCY_PALETTE.resonanceBlue} />
                    <stop offset="1" stopColor={FREQUENCY_PALETTE.frequencyPink} />
                </linearGradient>
            </defs>
            <circle cx="100" cy="100" r="96" fill="url(#celebration-disc)" />
            {rings.map((r) => (
                <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="rgba(3,3,3,0.35)" strokeWidth="0.8" />
            ))}
            <circle cx="100" cy="100" r="12" fill={FREQUENCY_PALETTE.void} />
        </motion.svg>
    );
}

export const CelebrationMoment = createCallable<CelebrationMomentProps, CelebrationResult>(({ call, eyebrow = 'Milestone unlocked', headline, detail, template, options, nextSteps }) => {
    const titleId = useId();
    const descriptionId = useId();
    const reducedMotion = useReducedMotion() ?? false;
    const [soundOn, setSoundOn] = useState(isMilestoneSoundEnabled);
    const confettiRef = useRef<HTMLCanvasElement | null>(null);
    const setModule = useStore((s) => s.setModule);

    useEffect(() => {
        playSonicLogo();
        const canvas = confettiRef.current;
        if (!canvas || reducedMotion) return;
        return burstConfetti(canvas);
    }, [reducedMotion]);

    const toggleSound = () => {
        const next = !soundOn;
        setSoundOn(next);
        setMilestoneSoundEnabled(next);
        if (next) playSonicLogo();
    };

    const handleShare = () => {
        call.end('shared');
        void ShareSheet.call({ title: 'Share your milestone', template, options, initialSize: 'square' });
    };

    const handleNextStep = (moduleId: ModuleId) => {
        call.end('dismissed');
        setModule(moduleId);
    };

    return (
        <Modal isOpen={true} onClose={() => call.end('dismissed')} titleId={titleId} descriptionId={descriptionId} maxWidth="max-w-md" portal overlayZIndex={100001}>
            <div className="relative flex flex-col items-center gap-5 overflow-hidden px-6 pb-7 pt-9 text-center">
                <canvas
                    ref={confettiRef}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                />
                <button
                    type="button"
                    onClick={toggleSound}
                    aria-pressed={soundOn}
                    aria-label="Milestone sound"
                    className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-[3px] focus-visible:outline-amber-400 focus-visible:outline-offset-2"
                >
                    {soundOn ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
                </button>
                <div className="relative z-10">
                    <SignatureDisc still={reducedMotion} />
                </div>
                <div className="relative z-10">
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#00F0FF]">{eyebrow}</p>
                    <h2 id={titleId} className="mt-2 text-xl font-black tracking-tight text-white">{headline}</h2>
                    {detail && <p id={descriptionId} className="mt-2 text-sm text-gray-400">{detail}</p>}
                </div>
                <div className="relative z-10 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                    <button type="button" onClick={handleShare} className={`${SIGNATURE_BUTTON_BASE} ${indigo.button} min-h-11 px-6 text-sm`}>
                        <Share2 size={16} className={indigo.icon} />
                        <span className={indigo.label}>Share it</span>
                        <span aria-hidden="true" className={indigo.sweep} />
                    </button>
                    <button type="button" onClick={() => call.end('dismissed')} className="min-h-11 rounded-xl px-5 text-sm font-semibold text-gray-400 transition-colors hover:text-white">
                        Not now
                    </button>
                </div>
                {nextSteps && nextSteps.length > 0 && (
                    <div className="relative z-10 w-full border-t border-white/10 pt-4">
                        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber-400">
                            Now what?
                        </p>
                        <div className="mt-2.5 flex flex-wrap justify-center gap-2">
                            {nextSteps.map((step) => (
                                <button
                                    key={step.moduleId}
                                    type="button"
                                    onClick={() => handleNextStep(step.moduleId)}
                                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/85 transition-colors hover:border-amber-400/50 hover:text-white"
                                >
                                    <span>{step.label}</span>
                                    <ArrowRight size={12} className="text-amber-400" aria-hidden="true" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
});
