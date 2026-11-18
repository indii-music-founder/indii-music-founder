/**
 * ShareSheet — awaited dialog that previews a branded share card and lets
 * the artist download or share it as an image.
 *
 *   await ShareSheet.call({ template: { kind: 'presave', ... } });
 *
 * Mount `<ShareSheet />` once next to the other callable roots.
 */
import { createCallable } from 'react-call';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Download, Loader2, Share2, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import {
    SHARE_CARD_DIMENSIONS,
    buildShareCardModel,
    shareCardFileName,
    type ShareCardOptions,
    type ShareCardSize,
    type ShareCardTemplate,
} from '@shared/share/shareCardTemplates';
import { renderShareCard } from '@shared/share/ShareCardRenderer';
import { downloadBlob, shareOrDownloadImage } from '@shared/share/shareFile';
import { SIGNATURE_BUTTON_BASE, SIGNATURE_BUTTON_TONES } from '@shared/share/signatureButton';

const indigo = SIGNATURE_BUTTON_TONES.indigo;

export interface ShareSheetProps {
    template: ShareCardTemplate;
    options?: ShareCardOptions;
    title?: string;
    initialSize?: ShareCardSize;
}

export type ShareSheetResult = 'shared' | 'downloaded' | 'dismissed';

const SIZES: ShareCardSize[] = ['story', 'square', 'og'];

export const ShareSheet = createCallable<ShareSheetProps, ShareSheetResult>(({ call, template, options, title = 'Share card', initialSize = 'story' }) => {
    const titleId = useId();
    const descriptionId = useId();
    const [size, setSize] = useState<ShareCardSize>(initialSize);
    const [rendered, setRendered] = useState<{ size: ShareCardSize; blob: Blob; url: string; coverOmitted: boolean } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const urlRef = useRef<string | null>(null);

    const model = useMemo(() => buildShareCardModel(template, options), [template, options]);

    useEffect(() => {
        let cancelled = false;
        setError(null);
        renderShareCard(model, size)
            .then(({ blob, coverOmitted }) => {
                if (cancelled) return;
                const url = URL.createObjectURL(blob);
                if (urlRef.current) URL.revokeObjectURL(urlRef.current);
                urlRef.current = url;
                setRendered({ size, blob, url, coverOmitted });
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Could not create the share card.');
            });
        return () => { cancelled = true; };
    }, [model, size]);

    useEffect(() => () => {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    }, []);

    const ready = rendered?.size === size ? rendered : null;
    const fileName = shareCardFileName(model, size);
    const dims = SHARE_CARD_DIMENSIONS[size];

    const handleShare = async () => {
        if (!ready) return;
        setBusy(true);
        try {
            const outcome = await shareOrDownloadImage(ready.blob, fileName, { title: model.title, text: model.callout });
            if (outcome !== 'cancelled') call.end(outcome);
        } finally {
            setBusy(false);
        }
    };

    const handleDownload = () => {
        if (!ready) return;
        downloadBlob(ready.blob, fileName);
        call.end('downloaded');
    };

    return (
        <Modal isOpen={true} onClose={() => call.end('dismissed')} titleId={titleId} descriptionId={descriptionId} maxWidth="max-w-lg" portal overlayZIndex={100000}>
            <div className="p-6">
                <h2 id={titleId} className="mb-1 text-xl font-bold text-white">{title}</h2>
                <p id={descriptionId} className="mb-4 text-sm text-gray-400">Post it to your story, feed, or drop it in a chat.</p>

                <div role="radiogroup" aria-label="Card size" className="mb-4 flex gap-2">
                    {SIZES.map(option => (
                        <button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={size === option}
                            onClick={() => setSize(option)}
                            className={`min-h-11 flex-1 rounded-lg border px-3 text-xs font-semibold transition-colors ${size === option ? 'border-white/40 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'}`}
                        >
                            {SHARE_CARD_DIMENSIONS[option].label}
                        </button>
                    ))}
                </div>

                <div className="flex h-[420px] items-center justify-center rounded-xl border border-white/10 bg-black/60 p-3">
                    {error ? (
                        <p role="alert" className="flex items-center gap-2 text-sm text-red-400"><AlertCircle size={16} /> {error}</p>
                    ) : ready ? (
                        <img
                            src={ready.url}
                            alt={`${model.title} share card, ${dims.width}×${dims.height}`}
                            className="max-h-full max-w-full rounded-md object-contain shadow-2xl"
                        />
                    ) : (
                        <Loader2 aria-label="Rendering card" className="animate-spin text-gray-400" size={24} />
                    )}
                </div>
                {ready?.coverOmitted && (
                    <p className="mt-2 text-xs text-amber-400">Cover art couldn&apos;t be embedded from its host, so the card uses your brand disc instead.</p>
                )}

                <div className="mt-5 flex justify-end gap-3">
                    <Button variant="ghost" onClick={handleDownload} disabled={!ready || busy}>
                        <Download size={16} className="mr-2" /> Download
                    </Button>
                    <button type="button" onClick={() => void handleShare()} disabled={!ready || busy} className={`${SIGNATURE_BUTTON_BASE} ${indigo.button} min-h-10 px-5 text-sm`}>
                        {busy ? <Loader2 size={16} className={`animate-spin ${indigo.icon}`} /> : <Share2 size={16} className={indigo.icon} />}
                        <span className={indigo.label}>Share</span>
                        <span aria-hidden="true" className={indigo.sweep} />
                    </button>
                </div>
            </div>
        </Modal>
    );
});
