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
import { useEffect, useId, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Share2, Volume2, VolumeX } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { SIGNATURE_BUTTON_BASE, SIGNATURE_BUTTON_TONES } from '@shared/share/signatureButton';
import { FREQUENCY_PALETTE, type ShareCardOptions, type ShareCardTemplate } from '@shared/share/shareCardTemplates';
import { ShareSheet } from './ShareSheet';
import { isMilestoneSoundEnabled, playSonicLogo, setMilestoneSoundEnabled } from '@/services/share/milestones';

export interface CelebrationMomentProps {
    eyebrow?: string;
    headline: string;
    detail?: string;
    /** Card the "Share it" button opens in the ShareSheet. */
    template: ShareCardTemplate;
    options?: ShareCardOptions;
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

export const CelebrationMoment = createCallable<CelebrationMomentProps, CelebrationResult>(({ call, eyebrow = 'Milestone unlocked', headline, detail, template, options }) => {
    const titleId = useId();
    const descriptionId = useId();
    const reducedMotion = useReducedMotion() ?? false;
    const [soundOn, setSoundOn] = useState(isMilestoneSoundEnabled);

    useEffect(() => {
        playSonicLogo();
    }, []);

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

    return (
        <Modal isOpen={true} onClose={() => call.end('dismissed')} titleId={titleId} descriptionId={descriptionId} maxWidth="max-w-md" portal overlayZIndex={100001}>
            <div className="relative flex flex-col items-center gap-5 px-6 pb-7 pt-9 text-center">
                <button
                    type="button"
                    onClick={toggleSound}
                    aria-pressed={soundOn}
                    aria-label={soundOn ? 'Turn milestone sound off' : 'Turn milestone sound on'}
                    className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                    {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <SignatureDisc still={reducedMotion} />
                <div>
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#00F0FF]">{eyebrow}</p>
                    <h2 id={titleId} className="mt-2 text-3xl font-black tracking-tight text-white">{headline}</h2>
                    {detail && <p id={descriptionId} className="mt-2 text-sm text-gray-400">{detail}</p>}
                </div>
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                    <button type="button" onClick={handleShare} className={`${SIGNATURE_BUTTON_BASE} ${indigo.button} min-h-11 px-6 text-sm`}>
                        <Share2 size={16} className={indigo.icon} />
                        <span className={indigo.label}>Share it</span>
                        <span aria-hidden="true" className={indigo.sweep} />
                    </button>
                    <button type="button" onClick={() => call.end('dismissed')} className="min-h-11 rounded-xl px-5 text-sm font-semibold text-gray-400 transition-colors hover:text-white">
                        Not now
                    </button>
                </div>
            </div>
        </Modal>
    );
});
