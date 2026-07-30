import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { useStore } from '@/core/store';
import type { ModuleId } from '@/core/constants';

interface WidgetEmptyStateProps {
    icon: LucideIcon;
    /** Widget name, e.g. "Live Streams". */
    label: string;
    /** What this widget will show once there is data. One short sentence. */
    promise: string;
    /** Label for the single action that starts producing that data. */
    ctaLabel: string;
    /** Module the CTA navigates to. */
    ctaModule: ModuleId;
    /** Optional accent, defaults to the app's signature. Pass a CSS colour. */
    accentClass?: string;
}

/**
 * ISSUE-1291: the shared "nothing here yet" state for dashboard widgets.
 *
 * A brand-new artist's dashboard is almost entirely zeroes, and a big bold `0`
 * beside "TOTAL DSP PERFORMANCE" reads as failure — it says "you have nothing"
 * rather than "this is where your streams will appear once you release." Worse,
 * a zero is indistinguishable from a widget that is simply broken.
 *
 * So an empty widget states what it will show and offers the one action that
 * starts it. The dashboard becomes a set of on-ramps instead of a scoreboard
 * reading nil, without inventing any data to fill the space.
 */
export function WidgetEmptyState({
    icon: Icon,
    label,
    promise,
    ctaLabel,
    ctaModule,
    accentClass = 'text-dept-creative',
}: WidgetEmptyStateProps) {
    const setModule = useStore(state => state.setModule);

    return (
        <div className="flex h-full flex-col justify-between group/widget">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] transition-colors group-hover/widget:border-white/20">
                    <Icon size={18} className={`${accentClass} opacity-70`} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{label}</span>
            </div>

            <div className="my-4 flex-1 flex flex-col justify-center">
                <p className="text-sm font-medium leading-snug text-white/70">{promise}</p>
            </div>

            <motion.button
                onClick={() => setModule(ctaModule)}
                whileTap={{ scale: 0.98 }}
                className="group/cta flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-left transition-all hover:border-dept-creative/40 hover:bg-dept-creative/10"
            >
                <span className="text-[11px] font-bold uppercase tracking-wider text-white/80 group-hover/cta:text-white">
                    {ctaLabel}
                </span>
                <ArrowRight
                    size={14}
                    className="shrink-0 text-white/40 transition-transform group-hover/cta:translate-x-0.5 group-hover/cta:text-dept-creative"
                />
            </motion.button>
        </div>
    );
}
