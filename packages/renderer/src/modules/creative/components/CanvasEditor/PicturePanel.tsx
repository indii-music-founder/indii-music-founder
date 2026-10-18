import { centeredArtworkPosition } from '@/services/canvas/ArtworkGeometry';
import React, { useEffect, useState } from 'react';
import { StorageService } from '@/services/StorageService';
import { useStore } from '@/core/store';
import { NEUTRAL_ADJUSTMENTS, type RasterLayer } from '@/services/canvas/CanvasDoc';
import { artworkTransform, loadArtworkImage } from '@/services/canvas/ArtworkRenderService';

export const PicturePanel: React.FC<{ layer: RasterLayer; onFrameChange?: (active: boolean, mode?: 'frame' | 'adjustments') => void }> = ({ layer, onFrameChange }) => {
    const doc = useStore(s => s.currentDoc);
    const update = useStore(s => s.updateLayer);
    const begin = useStore(s => s.beginCanvasGesture);
    const commit = useStore(s => s.commitCanvasGesture);
    const cancel = useStore(s => s.cancelCanvasGesture);
    const [resizing, setResizing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [framing, setFraming] = useState(false);
    const [upgrading, setUpgrading] = useState(false);
    const [loadedDimensions, setDimensions] = useState<{ src: string; width: number; height: number } | null>(null);
    const dimensions = loadedDimensions?.src === layer.src ? loadedDimensions : null;
    useEffect(() => {
        let active = true;
        void loadArtworkImage(layer.src).then(image => { if (active) setDimensions({ src: layer.src, width: image.width, height: image.height }); }).catch(() => undefined);
        return () => { active = false; commit(); };
    }, [layer.id, layer.src, commit]);
    if (!doc) return null;
    const transform = dimensions ? artworkTransform(layer, dimensions.width, dimensions.height, doc) : null;
    const fit = dimensions ? Math.min(doc.width / dimensions.width, doc.height / dimensions.height) : 1;
    const resizePhoto = async () => {
        const uid = useStore.getState().user?.uid;
        if (!uid) { setError('Sign in to prepare this photo'); return; }
        if (layer.maskSrc) { setError('Reset the existing cutout before resizing this photo'); return; }
        setResizing(true); setError(null);
        try {
            const original = await loadArtworkImage(layer.src);
            const ratio = Math.min(1, Math.sqrt(24_000_000 / (original.width * original.height)));
            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(original.width * ratio); canvas.height = Math.floor(original.height * ratio);
            const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Photo resizing unavailable');
            ctx.drawImage(original.getElement(), 0, 0, canvas.width, canvas.height);
            const width = canvas.width, height = canvas.height;
            const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Photo could not be resized')), 'image/png'));
            canvas.width = 0; canvas.height = 0;
            const src = await StorageService.uploadFile(blob, `users/${uid}/artwork/${doc.id}/${crypto.randomUUID()}.png`);
            const current = useStore.getState().currentDoc;
            const selected = current?.layers.find(photo => photo.id === layer.id);
            if (current?.id !== doc.id || useStore.getState().user?.uid !== uid || selected?.kind !== 'raster' || selected.src !== layer.src) return;
            update(layer.id, { src, originalSrc: layer.originalSrc ?? layer.src,
                scaleX: selected.scaleX * original.width / width, scaleY: selected.scaleY * original.height / height });
        } catch (failure) { setError(failure instanceof Error ? failure.message : 'Photo could not be prepared'); }
        finally { setResizing(false); }
    };
    const gesture = { onPointerDown: begin, onPointerUp: commit, onKeyDown: begin, onKeyUp: commit, onBlur: commit };
    return <div className="flex flex-col gap-2 p-3 text-xs text-white/70" aria-label="Photo composition">
        {dimensions && dimensions.width * dimensions.height > 24_000_000 && <>
            <p>This photo is larger than the editing limit. Create a smaller editing copy; your original photo will be kept.</p>
            <button disabled={resizing || layer.locked || framing || upgrading} onClick={() => void resizePhoto()}>{resizing ? 'Preparing photo…' : 'Create editing copy'}</button>
        </>}
        {error && <p role="alert" className="text-red-300">{error}</p>}
        <div className="flex gap-2">
            <button disabled={layer.locked || framing || upgrading} onClick={() => { begin(); setFraming(true); onFrameChange?.(true); }}>Frame photo</button>
            <button disabled={layer.locked || upgrading} onClick={() => update(layer.id, { framing: 'fit' })}>Fit photo</button>
            <button disabled={layer.locked || upgrading} onClick={() => update(layer.id, { framing: 'fill' })}>Fill cover</button>
        </div>
        {framing && <>
            <p>Drag and zoom the photo inside the square. The original pixels are kept.</p>
            <div className="flex gap-3"><button onClick={() => { commit(); setFraming(false); onFrameChange?.(false); }}>Apply frame</button><button onClick={() => { cancel(); setFraming(false); onFrameChange?.(false); }}>Cancel frame</button></div>
        </>}
        <label>Photo zoom<input aria-label="Photo zoom" type="range" min={0.1} max={8} step={0.01} disabled={!transform || layer.locked || upgrading}
            value={transform ? transform.scaleX / fit : 1} {...(framing ? {} : gesture)}
            onChange={event => {
                if (!transform || !dimensions) return;
                const scale = Number(event.target.value) * fit;
                const ratio = scale / transform.scaleX;
                update(layer.id, { framing: undefined, transformAnchor: 'top-left', scaleX: scale, scaleY: transform.scaleY * ratio,
                    x: doc.width / 2 + (transform.x - doc.width / 2) * ratio, y: doc.height / 2 + (transform.y - doc.height / 2) * ratio });
            }} className="block w-full" /></label>
        <button disabled={!transform || layer.locked || upgrading} onClick={() => { if (transform && dimensions) update(layer.id, {
            framing: undefined, transformAnchor: 'top-left',
            ...centeredArtworkPosition(dimensions.width, dimensions.height, transform.scaleX, transform.scaleY, transform.rotation, doc),
            scaleX: transform.scaleX, scaleY: transform.scaleY,
        }); }}>Center artist</button>
        {upgrading && <>
            <p>Previewing updated adjustments. Your original version is kept until you choose.</p>
            <button onClick={() => { commit(); setUpgrading(false); onFrameChange?.(false); }}>Use updated adjustments</button>
            <button onClick={() => { cancel(); setUpgrading(false); onFrameChange?.(false); }}>Keep original adjustments</button>
        </>}
        {!framing && !upgrading && <>{layer.adjustmentVersion !== 2 ? <>
            <p>Original adjustment behavior is preserved. Preview updated adjustments before saving this artwork.</p>
            <button onClick={() => { begin(); setUpgrading(true); onFrameChange?.(true, 'adjustments'); update(layer.id, { adjustmentVersion: 2 }); }}>Preview updated adjustments</button>
        </> : <>
            <label>Look<select aria-label="Photo look" value={layer.look?.id ?? 'original'} onChange={event => update(layer.id, { look: {
                id: event.target.value as NonNullable<RasterLayer['look']>['id'], strength: layer.look?.strength ?? 1, version: 1,
            } })} className="block w-full bg-black/40">
                <option value="original">Original</option><option value="warm-film">Warm Film</option><option value="cool-night">Cool Night</option><option value="mono">Mono</option>
            </select></label>
            <label>Look strength<input aria-label="Look strength" type="range" min={0} max={1} step={0.01} value={layer.look?.strength ?? 1} {...gesture}
                onChange={event => update(layer.id, { look: { id: layer.look?.id ?? 'original', strength: Number(event.target.value), version: 1 } })} className="block w-full" /></label>
            <label>Grain<input aria-label="Grain" type="range" min={0} max={1} step={0.01} value={layer.grain?.amount ?? 0} {...gesture}
                onChange={event => update(layer.id, { grain: { amount: Number(event.target.value), seed: layer.grain?.seed ?? Math.floor(Math.random() * 0xffffffff) } })} className="block w-full" /></label>
        </>}
        <button onClick={() => update(layer.id, { adjustments: { ...NEUTRAL_ADJUSTMENTS }, look: { id: 'original', strength: 1, version: 1 }, grain: { amount: 0, seed: layer.grain?.seed ?? 0 } })}>Reset adjustments and style</button></>}
    </div>;
};
