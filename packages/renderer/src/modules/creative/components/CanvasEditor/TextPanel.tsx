import { alignedArtworkPosition } from '@/services/canvas/ArtworkGeometry';
import React, { useEffect, useState } from 'react';
import { BUNDLED_ARTWORK_FONTS } from '@/services/canvas/BundledArtworkFonts';
import { FontLibrary, type RegisteredFont } from '@/services/typography/FontLibrary';
import { useStore } from '@/core/store';
import type { TextLayer } from '@/services/canvas/CanvasDoc';
import { renderArtworkSource, artworkSourceDensity } from '@/services/canvas/ArtworkRenderService';

export const TextPanel: React.FC<{ layer?: TextLayer }> = ({ layer }) => {
    const [fonts, setFonts] = useState<Pick<RegisteredFont, 'id' | 'family' | 'style'>[]>([...BUNDLED_ARTWORK_FONTS]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const updateLayer = useStore(s => s.updateLayer);
    const addText = useStore(s => s.addTextLayer);
    const begin = useStore(s => s.beginCanvasGesture);
    const commit = useStore(s => s.commitCanvasGesture);
    useEffect(() => {
        let active = true;
        void FontLibrary.listFonts().then(list => { if (active) setFonts([...list, ...BUNDLED_ARTWORK_FONTS]); }).catch(failure => { if (active) setError(String(failure)); });
        return () => { active = false; };
    }, []);
    const patch = (value: Partial<TextLayer['typography']>) => {
        const current = useStore.getState().currentDoc?.layers.find(item => item.id === layer?.id);
        if (current?.kind === 'text') updateLayer(current.id, { typography: { ...current.typography, ...value, vector: undefined } });
    };
    const upload = async (file: File) => {
        setBusy(true); setError(null);
        try { const font = await FontLibrary.registerFont(file); setFonts(previous => [font, ...previous]); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Font upload failed'); }
        finally { setBusy(false); }
    };
    const add = () => {
        const doc = useStore.getState().currentDoc;
        if (!doc || !fonts[0]) return;
        const title = doc.layers.some(layer => layer.kind === 'text');
        addText({ text: title ? 'Release title' : 'Artist name', fontId: fonts[0].id, fontSize: 180 * doc.width / 3000, fill: '#ffffff',
            letterSpacing: 0, kerning: true, x: doc.width / 2, y: doc.height * (title ? 0.86 : 0.78), opacity: 1, visible: true, rotation: 0 }, 'center');
    };
    const align = async (position: 'left' | 'center' | 'right') => {
        const doc = useStore.getState().currentDoc;
        if (!doc || !layer) return;
        try {
            const source = await renderArtworkSource(layer);
            const current = useStore.getState().currentDoc;
            const selected = current?.layers.find(item => item.id === layer.id);
            if (current?.id !== doc.id || selected !== layer) return;
            const density = artworkSourceDensity(source);
            updateLayer(layer.id, alignedArtworkPosition(layer, source.width / density, source.height / density, doc, position));
        } catch (failure) { setError(String(failure)); }
    };
    return <div className="flex flex-col gap-2 p-3 text-xs text-white/70" aria-label="Text composition">
        <button disabled={!fonts.length || busy} onClick={add} className="rounded border border-white/20 p-2 disabled:opacity-30">Add text</button>
        {!fonts.length && <p>Upload a font to add editable artist and title text.</p>}
        <label>Upload font<input type="file" accept=".ttf,.otf,.woff" disabled={busy} onChange={event => {
            const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file);
        }} className="block max-w-full" /></label>
        {layer && <>
            <label>Text<input type="text" aria-label="Text content" value={layer.typography.text} onFocus={begin} onBlur={commit}
                onChange={e => patch({ text: e.target.value })} className="block w-full bg-black/40 p-2" /></label>
            <label>Font<select aria-label="Text font" value={layer.typography.fontId} onChange={e => patch({ fontId: e.target.value })} className="block w-full bg-black/40">
                {!fonts.some(font => font.id === layer.typography.fontId) && <option value={layer.typography.fontId}>Saved font</option>}
                {fonts.map(font => <option key={font.id} value={font.id}>{font.family} · {font.style}</option>)}
            </select></label>
            <label>Size<input aria-label="Text size" type="number" min={1} max={12000} value={layer.typography.fontSize}
                onFocus={begin} onBlur={commit} onChange={e => { const value = Number(e.target.value); if (value >= 1 && value <= 12000) patch({ fontSize: value }); }} className="block w-full bg-black/40" /></label>
            <label>Letter spacing<input aria-label="Letter spacing" type="number" min={-1000} max={1000} value={layer.typography.letterSpacing}
                onFocus={begin} onBlur={commit} onChange={e => { const value = Number(e.target.value); if (value >= -1000 && value <= 1000) patch({ letterSpacing: value }); }} className="block w-full bg-black/40" /></label>
            <label>Text color<input aria-label="Text color" type="color" value={layer.typography.fill} onChange={e => patch({ fill: e.target.value })} /></label>
            <div className="flex gap-2">{(['left', 'center', 'right'] as const).map(position => <button key={position} onClick={() => void align(position)}>{position}</button>)}</div>
        </>}
        <details className="text-[10px] text-white/40"><summary>Bundled font licenses</summary>
            {BUNDLED_ARTWORK_FONTS.map(font => <a key={font.id} href={font.licenseUrl} target="_blank" rel="noreferrer" className="block underline">{font.family}</a>)}
        </details>
        {error && <p role="alert" className="text-red-300">{error}</p>}
    </div>;
};
