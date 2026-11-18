/**
 * Signature button recipe — distilled from the Sidebar "Boardroom" button
 * (packages/renderer/src/core/components/Sidebar.tsx), the founder's
 * favorite control in the product: soft tinted gradient fill, hairline
 * tinted border, hover glow + icon lift, and a light sweep across the face.
 *
 * Tailwind needs full literal class names, so each tone is spelled out.
 * Render `SIGNATURE_BUTTON_SWEEP` as the last child of the button and add
 * `group-hover:scale-110` to the icon.
 */
export type SignatureTone = 'indigo' | 'gold';

export const SIGNATURE_BUTTON_BASE =
    'group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl font-bold tracking-wide transition-all disabled:pointer-events-none disabled:opacity-50';

export const SIGNATURE_BUTTON_TONES: Record<SignatureTone, { button: string; icon: string; label: string; sweep: string }> = {
    indigo: {
        button: 'bg-linear-to-r from-indigo-500/10 to-indigo-600/5 border border-indigo-500/20 hover:border-indigo-500/40 hover:shadow-[0_0_15px_rgba(99,102,241,0.35)]',
        icon: 'relative z-10 shrink-0 text-indigo-400 transition-all group-hover:scale-110 group-hover:text-indigo-300',
        label: 'relative z-10 text-indigo-300/90 transition-colors group-hover:text-indigo-200',
        sweep: 'pointer-events-none absolute inset-0 rounded-xl bg-linear-to-r from-transparent via-indigo-400/10 to-transparent translate-x-[-100%] transition-transform duration-700 group-hover:translate-x-[100%]',
    },
    gold: {
        button: 'bg-linear-to-r from-[#FFB800]/10 to-[#E65100]/5 border border-[#FFB800]/25 hover:border-[#FFB800]/50 hover:shadow-[0_0_15px_rgba(255,184,0,0.35)]',
        icon: 'relative z-10 shrink-0 text-[#FFB800] transition-all group-hover:scale-110 group-hover:text-[#FFD700]',
        label: 'relative z-10 text-[#FFD27A] transition-colors group-hover:text-white',
        sweep: 'pointer-events-none absolute inset-0 rounded-xl bg-linear-to-r from-transparent via-[#FFB800]/15 to-transparent translate-x-[-100%] transition-transform duration-700 group-hover:translate-x-[100%]',
    },
};
