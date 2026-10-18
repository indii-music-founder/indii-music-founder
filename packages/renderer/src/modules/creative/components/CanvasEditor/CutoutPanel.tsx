import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '@/core/store';
import type { RasterLayer } from '@/services/canvas/CanvasDoc';
import type { CutoutPoint, CutoutRectangle, CutoutStroke } from '@/services/canvas/segmentation/GrabCut';
import { loadArtworkImage } from '@/services/canvas/ArtworkRenderService';
import { generateArtworkMask, persistArtworkMask } from '@/services/canvas/MaskService';

export const CutoutPanel: React.FC<{ layer: RasterLayer }> = ({ layer }) => {
    const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
    const [mode, setMode] = useState<'box' | 'keep' | 'remove'>('box');
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
    const [rectangle, setRectangle] = useState<CutoutRectangle | null>(null);
    const [strokes, setStrokes] = useState<CutoutStroke[]>([]);
    const [mask, setMask] = useState<Uint8Array | null>(null);
    const [error, setError] = useState<string | null>(null), [progress, setProgress] = useState(0);
    const [radius, setRadius] = useState(30), [softness, setSoftness] = useState(layer.maskFeather ?? 1);
    const canvas = useRef<HTMLCanvasElement>(null), image = useRef<CanvasImageSource | null>(null);
    const start = useRef<CutoutPoint | null>(null), drawing = useRef(false);
    const controller = useRef<AbortController | null>(null), generation = useRef(0), active = useRef(true);
    const update = useStore(state => state.updateLayer);
    useEffect(() => { active.current = true; return () => { active.current = false; controller.current?.abort(); }; }, []);
    const begin = async () => {
        const session = ++generation.current;
        setOpen(true); setBusy(true); setError(null); setMask(null); setRectangle(null); setStrokes([]); setMode('box');
        try {
            const photo = await loadArtworkImage(layer.src);
            if (!active.current || generation.current !== session) return;
            if (photo.width * photo.height > 24_000_000) throw new Error('Resize this photo below 24 megapixels before making a cutout');
            image.current = photo.getElement(); setDimensions({ width: photo.width, height: photo.height });
        } catch (failure) { if (active.current && generation.current === session) setError(String(failure)); }
        finally { if (active.current && generation.current === session) setBusy(false); }
    };
    useEffect(() => {
        const el = canvas.current, source = image.current;
        if (!open || !el || !source || !dimensions) return;
        const scale = Math.min(280 / dimensions.width, 340 / dimensions.height);
        el.width = Math.max(1, Math.round(dimensions.width * scale)); el.height = Math.max(1, Math.round(dimensions.height * scale));
        const ctx = el.getContext('2d'); if (!ctx) return;
        ctx.drawImage(source, 0, 0, el.width, el.height);
        if (mask) {
            const overlay = ctx.createImageData(el.width, el.height);
            for (let y = 0; y < el.height; y++) for (let x = 0; x < el.width; x++) {
                const sourceX = Math.min(dimensions.width - 1, Math.floor(x / scale)), sourceY = Math.min(dimensions.height - 1, Math.floor(y / scale));
                const i = (y * el.width + x) * 4;
                overlay.data[i] = 30; overlay.data[i + 1] = 220; overlay.data[i + 2] = 140;
                overlay.data[i + 3] = mask[sourceY * dimensions.width + sourceX] ? 90 : 0;
            }
            const temporary = document.createElement('canvas'); temporary.width = el.width; temporary.height = el.height;
            temporary.getContext('2d')?.putImageData(overlay, 0, 0); ctx.drawImage(temporary, 0, 0);
        }
        if (rectangle) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(rectangle.x * scale, rectangle.y * scale, rectangle.width * scale, rectangle.height * scale); }
        for (const stroke of strokes) {
            ctx.strokeStyle = stroke.label === 'keep' ? '#22ee88' : '#ff5566'; ctx.fillStyle = ctx.strokeStyle;
            ctx.lineWidth = stroke.radius * 2 * scale; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
            stroke.points.forEach((point, index) => { if (!index) ctx.moveTo(point.x * scale, point.y * scale); else ctx.lineTo(point.x * scale, point.y * scale); });
            ctx.stroke();
            const point = stroke.points[0]; if (point) { ctx.beginPath(); ctx.arc(point.x * scale, point.y * scale, stroke.radius * scale, 0, Math.PI * 2); ctx.fill(); }
        }
    }, [open, dimensions, rectangle, strokes, mask]);
    const point = (event: React.PointerEvent<HTMLCanvasElement>): CutoutPoint => {
        const bounds = event.currentTarget.getBoundingClientRect();
        return { x: Math.max(0, Math.min(dimensions!.width, (event.clientX - bounds.left) / bounds.width * dimensions!.width)),
            y: Math.max(0, Math.min(dimensions!.height, (event.clientY - bounds.top) / bounds.height * dimensions!.height)) };
    };
    const process = async () => {
        if (!dimensions || !rectangle || !image.current) return;
        const session = ++generation.current, abort = new AbortController(); controller.current = abort;
        setBusy(true); setError(null); setProgress(0); setMask(null);
        try {
            const full = document.createElement('canvas'); full.width = dimensions.width; full.height = dimensions.height;
            const ctx = full.getContext('2d'); if (!ctx) throw new Error('Photo pixels could not be read');
            ctx.drawImage(image.current, 0, 0);
            const pixels = ctx.getImageData(0, 0, full.width, full.height).data;
            full.width = 0; full.height = 0;
            const result = await generateArtworkMask({ ...dimensions, pixels, rectangle, strokes }, abort.signal, value => {
                if (active.current && generation.current === session) setProgress(value);
            });
            if (active.current && generation.current === session) setMask(result);
        } catch (failure) {
            if (active.current && generation.current === session && !(failure instanceof DOMException && failure.name === 'AbortError')) setError(failure instanceof Error ? failure.message : 'Cutout failed');
        } finally { if (active.current && generation.current === session) setBusy(false); }
    };
    const apply = async () => {
        const doc = useStore.getState().currentDoc, uid = useStore.getState().user?.uid;
        if (!doc || !dimensions || !mask) return;
        const session = ++generation.current;
        setBusy(true); setError(null);
        try {
            const src = await persistArtworkMask(mask, dimensions.width, dimensions.height, doc.id);
            const current = useStore.getState().currentDoc, photo = current?.layers.find(item => item.id === layer.id);
            if (!active.current || session !== generation.current || current?.id !== doc.id || useStore.getState().user?.uid !== uid || photo?.kind !== 'raster' || photo.src !== layer.src || photo.maskSrc !== layer.maskSrc) return;
            update(layer.id, { maskSrc: src, maskFeather: softness, subjectIsolated: true });
            setOpen(false); setMask(null);
        } catch (failure) { if (active.current && generation.current === session) setError(failure instanceof Error ? failure.message : 'Cutout could not be saved'); }
        finally { if (active.current && generation.current === session) setBusy(false); }
    };
    const cancel = () => { generation.current++; controller.current?.abort(); setOpen(false); setBusy(false); setMask(null); image.current = null; };
    return <div className="flex flex-col gap-2 p-3 text-xs text-white/70" aria-label="Artist cutout">
        {!open ? <>
            <button disabled={layer.locked} onClick={() => void begin()}>Remove background</button>
            {layer.maskSrc && <button onClick={() => update(layer.id, { maskSrc: undefined, maskFeather: undefined, subjectIsolated: false })}>Reset cutout</button>}
        </> : <>
            <p>Draw a box around the artist. Mark areas to keep or remove, then preview the cutout. Green shows what will stay.</p>
            <div className="flex gap-2">{(['box', 'keep', 'remove'] as const).map(value => <button key={value} disabled={busy} aria-pressed={mode === value} onClick={() => setMode(value)}>{value === 'box' ? 'Draw box' : value === 'keep' ? 'Keep' : 'Remove'}</button>)}</div>
            <canvas ref={canvas} className="max-w-full touch-none border border-white/20" aria-label="Draw artist selection" onPointerDown={event => {
                if (busy || !dimensions) return;
                event.currentTarget.setPointerCapture(event.pointerId); drawing.current = true; const p = point(event); start.current = p; setMask(null);
                if (mode === 'box') setRectangle({ x: p.x, y: p.y, width: 0, height: 0 });
                else setStrokes(previous => [...previous, { label: mode, radius, points: [p] }]);
            }} onPointerMove={event => {
                if (!drawing.current || !dimensions) return;
                const p = point(event);
                if (mode === 'box' && start.current) setRectangle({ x: Math.min(start.current.x, p.x), y: Math.min(start.current.y, p.y), width: Math.abs(p.x - start.current.x), height: Math.abs(p.y - start.current.y) });
                else setStrokes(previous => previous.map((stroke, index) => index === previous.length - 1 ? { ...stroke, points: [...stroke.points, p] } : stroke));
            }} onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }} />
            <label>Brush size<input type="range" min={1} max={200} value={radius} disabled={busy} onChange={event => setRadius(Number(event.target.value))} aria-label="Cutout brush size" /></label>
            <label>Edge softness<input type="range" min={0} max={8} step={0.25} value={softness} onChange={event => setSoftness(Number(event.target.value))} aria-label="Cutout edge softness" /></label>
            <button disabled={busy || !rectangle || rectangle.width < 2 || rectangle.height < 2} onClick={() => void process()}>Preview cutout</button>
            <button disabled={busy || !mask} onClick={() => void apply()}>Apply cutout</button>
            <button onClick={cancel}>Cancel</button>
            {busy && <p role="status">Preparing cutout… {Math.round(progress * 100)}%</p>}
            {error && <p role="alert" className="text-red-300">{error}</p>}
        </>}
    </div>;
};
