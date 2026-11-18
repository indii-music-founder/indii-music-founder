/**
 * Small "share this section" chip pinned to the top-right of a home-page
 * section. Shares `/s/:id` (which carries a section-specific link preview)
 * through the native share sheet when available, otherwise copies it.
 */
import { useEffect, useRef, useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { siteSectionSharePath, type SiteSection } from '@shared/share/siteSections';
import { SIGNATURE_BUTTON_BASE, SIGNATURE_BUTTON_TONES } from '@shared/share/signatureButton';

const gold = SIGNATURE_BUTTON_TONES.gold;

export default function SectionShareChip({ section }: { section: SiteSection }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const flash = (next: 'copied' | 'failed') => {
    setState(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2000);
  };

  const handleClick = async () => {
    const url = `${window.location.origin}${siteSectionSharePath(section)}`;
    const coarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    if (coarsePointer && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${section.title} — indii.music`, url });
        return;
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      flash('copied');
    } catch {
      flash('failed');
    }
  };

  const label = state === 'copied' ? 'Link copied' : state === 'failed' ? 'Copy failed' : 'Share';

  return (
    <div className="pointer-events-none absolute right-4 top-28 z-30 md:right-8 md:top-32">
    <button
      type="button"
      onClick={() => void handleClick()}
      aria-label={state === 'idle' ? `Share the “${section.label}” section` : label}
      className={`${SIGNATURE_BUTTON_BASE} ${gold.button} pointer-events-auto h-9 bg-black/60 px-3 text-xs backdrop-blur-md`}
    >
      {state === 'copied' ? <Check className={`h-3.5 w-3.5 ${gold.icon}`} /> : <Link2 className={`h-3.5 w-3.5 ${gold.icon}`} />}
      <span className={gold.label} aria-live="polite">{label}</span>
      <span aria-hidden="true" className={gold.sweep} />
    </button>
    </div>
  );
}
