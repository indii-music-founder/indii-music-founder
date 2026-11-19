/**
 * Inline share panel for an Artist Passport result: renders a branded card
 * (feed/story), shares or downloads it, and copies the public result link.
 * Inline (not a modal) so it needs no dialog system on the landing site.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, Copy, Download, Loader2, Share2 } from 'lucide-react';
import { buildShareCardModel, shareCardFileName, type ShareCardSize } from '@shared/share/shareCardTemplates';
import { renderShareCard } from '@shared/share/ShareCardRenderer';
import { downloadBlob, shareOrDownloadImage } from '@shared/share/shareFile';
import { SIGNATURE_BUTTON_BASE, SIGNATURE_BUTTON_TONES } from '@shared/share/signatureButton';
import type { PassportAnswers } from '../../lib/passportEvaluator';
import { buildPassportShareUrl, passportCardTemplate } from '../../lib/passportShare';
import { trackPassportEvent } from '../../lib/passportAnalytics';

const gold = SIGNATURE_BUTTON_TONES.gold;
const SIZES: Array<{ id: ShareCardSize; label: string }> = [
  { id: 'square', label: 'Feed' },
  { id: 'story', label: 'Story' },
];

export default function PassportSharePanel({ answers, assessmentId }: { answers: PassportAnswers; assessmentId?: string | null }) {
  const [size, setSize] = useState<ShareCardSize>('square');
  const [preview, setPreview] = useState<{ size: ShareCardSize; blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const urlRef = useRef<string | null>(null);
  const copyTimer = useRef<number | null>(null);
  const radioRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const shareUrl = useMemo(() => buildPassportShareUrl(answers), [answers]);
  const model = useMemo(() => buildShareCardModel(passportCardTemplate(answers)), [answers]);

  useEffect(() => {
    let cancelled = false;
    renderShareCard(model, size)
      .then(({ blob }) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setPreview({ size, blob, url });
      })
      .catch(() => { if (!cancelled) setError('Could not create your card on this device.'); });
    return () => { cancelled = true; };
  }, [model, size]);

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    if (copyTimer.current) window.clearTimeout(copyTimer.current);
  }, []);

  const ready = preview?.size === size ? preview : null;
  const fileName = shareCardFileName(model, size);

  const handleShare = async () => {
    if (!ready) return;
    const outcome = await shareOrDownloadImage(ready.blob, fileName, { title: 'My Artist Passport', text: `My Artist Passport from indii — ${shareUrl}` });
    if (outcome !== 'cancelled') trackPassportEvent('freebie_clicked', { cta: 'passport_card_shared', outcome, size }, assessmentId);
  };

  const handleDownload = () => {
    if (!ready) return;
    downloadBlob(ready.blob, fileName);
    trackPassportEvent('freebie_clicked', { cta: 'passport_card_downloaded', size }, assessmentId);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
      trackPassportEvent('freebie_clicked', { cta: 'passport_link_copied' }, assessmentId);
    } catch {
      setError('Copy failed — select the link and copy it manually.');
    }
  };

  const handleSizeKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % SIZES.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + SIZES.length) % SIZES.length;
    if (nextIndex === -1) return;
    event.preventDefault();
    setError(null);
    setSize(SIZES[nextIndex].id);
    radioRefs.current[nextIndex]?.focus();
  };

  return (
    <section aria-labelledby="passport-share-heading" className="no-print rounded-2xl border border-[#1F222A] bg-[#070709] p-6">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center">
        <div className="flex h-72 items-center justify-center rounded-xl border border-white/5 bg-black/60 p-3">
          {error ? (
            <p role="status" className="text-sm text-red-400">{error}</p>
          ) : ready ? (
            <img src={ready.url} alt={`Artist Passport card: ${model.title}`} className="max-h-full max-w-full rounded-md object-contain shadow-2xl" />
          ) : (
            <Loader2 aria-label="Rendering card" className="h-6 w-6 animate-spin text-[#8A8F9E]" />
          )}
        </div>
        <div className="space-y-4">
          <div>
            <h3 id="passport-share-heading" className="text-lg font-black text-white">Share your Passport</h3>
            <p className="mt-1 text-sm text-[#8A8F9E]">Post your stage and let your circle find their own gaps. The link holds only your multiple-choice answers — no name or email.</p>
          </div>
          <div role="radiogroup" aria-label="Card size" className="flex gap-2">
            {SIZES.map((option, index) => (
              <button
                key={option.id}
                ref={(el) => { radioRefs.current[index] = el; }}
                type="button"
                role="radio"
                aria-checked={size === option.id}
                tabIndex={size === option.id ? 0 : -1}
                onClick={() => { setError(null); setSize(option.id); }}
                onKeyDown={(e) => handleSizeKeyDown(e, index)}
                className={`min-h-11 flex-1 rounded-lg border px-3 text-xs font-mono uppercase tracking-wider transition-colors focus-visible:outline-[3px] focus-visible:outline-[#FFB800] focus-visible:outline-offset-2 ${size === option.id ? 'border-[#FFB800]/50 bg-[#FFB800]/10 text-white' : 'border-white/10 bg-white/5 text-[#8A8F9E] hover:text-white'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => void handleShare()} disabled={!ready} className={`${SIGNATURE_BUTTON_BASE} ${gold.button} min-h-11 flex-1 px-5 text-sm`}>
              <Share2 className={`h-4 w-4 ${gold.icon}`} />
              <span className={gold.label}>Share card</span>
              <span aria-hidden="true" className={gold.sweep} />
            </button>
            <button type="button" onClick={handleDownload} disabled={!ready} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 transition-colors hover:text-white">
              <Download className="h-4 w-4" /> Download
            </button>
            <button type="button" onClick={() => void handleCopy()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 transition-colors hover:text-white">
              {copied ? <Check className="h-4 w-4 text-[#00FF66]" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
