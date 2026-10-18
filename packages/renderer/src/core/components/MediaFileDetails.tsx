import React, { useEffect, useState } from 'react';
import type { HistoryItem } from '@/core/types/history';
import { useResolvedStorageUrl } from '@/hooks/useResolvedStorageUrl';
import { inspectImageMetadata, physicalImageSize, type ImageFileMetadata } from '@/services/media/inspectImageMetadata';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

type Details = ImageFileMetadata & { size?: number; duration?: number };

/** Measures the saved original on demand; thumbnails and model settings are not file metadata. */
export function MediaFileDetails({ item, expanded = false, compact = false }: { item: HistoryItem; expanded?: boolean; compact?: boolean }) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const place = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        setPosition({ left: Math.max(8, Math.min(rect.right - 264, window.innerWidth - 272)),
            top: rect.bottom + 240 > window.innerHeight ? Math.max(8, rect.top - 240) : rect.bottom + 4 });
    };
    const [hovered, setHovered] = useState(false);
    const [request, setRequest] = useState(false);
    const [state, setState] = useState<{ url: string; details?: Details; error?: boolean }>();
    const source = item.storageUri || item.url;
    const { url, error: resolutionError } = useResolvedStorageUrl(expanded || open || request ? source : undefined);
    useEffect(() => {
        if (!url || (item.type !== 'image' && item.type !== 'video')) return;
        const controller = new AbortController();
        let video: HTMLVideoElement | undefined;
        let videoTimeout: ReturnType<typeof setTimeout> | undefined;
        const inspect = async (): Promise<Details> => {
            if (item.type === 'video') return new Promise((resolve, reject) => {
                video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = () => { clearTimeout(videoTimeout); resolve({ width: video!.videoWidth, height: video!.videoHeight,
                    duration: Number.isFinite(video!.duration) ? video!.duration : undefined }); };
                video.onerror = () => { clearTimeout(videoTimeout); reject(new Error('Unable to read video metadata')); };
                videoTimeout = setTimeout(() => reject(new Error('Video metadata unavailable')), 15000);
                video.src = url;
            });
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error('Unable to read original file');
            const blob = await response.blob();
            const details = inspectImageMetadata(new Uint8Array(await blob.arrayBuffer()));
            if (!details.width || !details.height) {
                const bitmap = await createImageBitmap(blob);
                details.width = bitmap.width; details.height = bitmap.height; bitmap.close();
            }
            return { ...details, size: blob.size, format: details.format || blob.type.replace('image/', '').toUpperCase() };
        };
        void inspect().then(details => {
            if (!controller.signal.aborted) setState({ url, details });
        }).catch(() => {
            if (!controller.signal.aborted) setState({ url, error: true });
        });
        return () => { controller.abort(); clearTimeout(videoTimeout); if (video) { video.removeAttribute('src'); video.load(); } };
    }, [url, item.type]);
    if (item.type !== 'image' && item.type !== 'video') return null;
    const details = state?.url === url ? state.details : undefined;
    const failed = resolutionError || (state?.url === url && state.error);
    const physical = details && physicalImageSize(details);
    const densityMissing = details?.format === 'PNG' || details?.format === 'JPEG' ? 'Not recorded' : 'Unavailable for this format';
    const number = (value: number) => +value.toFixed(2);
    return <div className="relative z-30 text-left" onClick={event => event.stopPropagation()} onMouseEnter={event => { place(event.currentTarget); setRequest(true); setHovered(true); }} onMouseLeave={() => setHovered(false)} onFocus={event => { place(event.currentTarget); setRequest(true); setHovered(true); }} onBlur={() => setHovered(false)} onKeyDown={event => { if (event.key === 'Escape' && (open || hovered)) { setOpen(false); setHovered(false); event.stopPropagation(); } }}>
        <button type="button" aria-label={`File details: ${item.prompt || 'Untitled'}`} aria-expanded={open || hovered}
            onClick={event => { place(event.currentTarget); setOpen(value => !value); }}
            className="inline-flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-[10px] text-gray-200 hover:text-white focus-visible:ring-2 focus-visible:ring-purple-400">
            <Info size={12} /><span className={compact ? 'sr-only' : undefined}>{expanded && details ? `Original: ${details.width} × ${details.height} px · ${details.dpiX ? number(details.dpiX) + ' DPI' : densityMissing === 'Not recorded' ? 'DPI not recorded' : 'DPI unavailable'}` : 'File details'}</span>
        </button>
        {(open || hovered) && createPortal(<div role="region" aria-label="Original file metadata" style={position} className="fixed z-[9999] w-[264px] max-w-[calc(100vw-16px)] rounded border border-white/20 bg-gray-950 p-2 text-[11px] text-gray-200 shadow-xl">
            <div className="flex items-center justify-between gap-2"><p className="font-semibold">Original file</p><button type="button" aria-label="Close file details" className="rounded px-1 text-gray-400 hover:text-white focus-visible:ring-2 focus-visible:ring-purple-400" onClick={() => { setOpen(false); setHovered(false); }}>×</button></div>
            {!details ? <p>{failed ? 'File details unavailable' : 'Reading original…'}</p> : <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt>Pixels</dt><dd>{details.width} × {details.height} px</dd>
                {details.format && <><dt>Format</dt><dd>{details.format}</dd></>}
                {details.size !== undefined && <><dt>File size</dt><dd>{number(details.size / 1048576)} MB</dd></>}
                {item.type === 'image' ? <><dt>DPI</dt><dd>{details.dpiX && details.dpiY ? `${number(details.dpiX)} × ${number(details.dpiY)}` : densityMissing}</dd>
                    <dt>Print size</dt><dd>{physical || 'Requires recorded DPI'}</dd></> : <><dt>Duration</dt><dd>{details.duration === undefined ? 'Not recorded' : `${number(details.duration)} s`}</dd><dt>Frame rate</dt><dd>Unavailable</dd></>}
            </dl>}
            <p className="mt-1 text-[10px] text-gray-400">{item.type === 'image' ? 'Print size uses recorded DPI. Canvas edits can change export dimensions.' : 'Source video dimensions; preview size may differ.'}</p>
        </div>, document.body)}
    </div>;
}
