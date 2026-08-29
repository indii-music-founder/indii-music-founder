import React, { useCallback, useEffect, useState } from 'react';
import { FontLibrary, type RegisteredFont } from '@/services/typography/FontLibrary';
import { renderTextPath, rasterizeVectorText } from '@/services/typography/TextVectorRenderer';
import { useStore } from '@/core/store';
import { logger } from '@/utils/logger';

export interface TypographyRenderResult {
    dataUrl: string;
    width: number;
    height: number;
    svgPathD: string;
    advanceWidth: number;
    text: string;
    fontId: string;
}

/**
 * TypographyPanel — brand font upload + deterministic wordmark renderer
 * (Workstream B2). Renders to a transparent PNG layer and records a
 * typography_layer history item. Uses the standardized canvas path only; no
 * image model, so letters are always exact.
 */
export default function TypographyPanel(): React.ReactElement {
    const [fonts, setFonts] = useState<RegisteredFont[]>([]);
    const [fontId, setFontId] = useState<string>('');
    const [text, setText] = useState('Dii');
    const [fontSize, setFontSize] = useState(96);
    const [fill, setFill] = useState('#ffffff');
    const [letterSpacing, setLetterSpacing] = useState(0);
    const [result, setResult] = useState<TypographyRenderResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const refreshFonts = useCallback(async () => {
        try {
            const list = await FontLibrary.listFonts();
            setFonts(list);
            setFontId(prev => prev || list[0]?.id || '');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load fonts');
        }
    }, []);

    useEffect(() => {
        let active = true;
        FontLibrary.listFonts()
            .then(list => {
                if (!active) return;
                setFonts(list);
                setFontId(prev => prev || list[0]?.id || '');
            })
            .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Failed to load fonts'); });
        return () => { active = false; };
    }, []);

    const handleUpload = useCallback(async (file: File | null) => {
        if (!file) return;
        setError(null);
        try {
            const meta = await FontLibrary.registerFont(file);
            await refreshFonts();
            setFontId(meta.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        }
    }, [refreshFonts]);

    const handleRender = useCallback(async () => {
        if (!text.trim()) { setError('Enter some text'); return; }
        if (!fontId) { setError('Upload a font first'); return; }
        setError(null);
        try {
            const font = await FontLibrary.loadOpenTypeFont(fontId);
            const vector = renderTextPath(text, font, { fontSize, x: 0, y: fontSize, letterSpacing, kerning: true });
            const raster = await rasterizeVectorText(vector, fill, 1);
            const { addToHistory, currentProjectId } = useStore.getState();
            const historyId = `typography_${Date.now()}`;
            addToHistory?.({
                id: historyId,
                url: raster.dataUrl,
                prompt: `Typography: ${text}`,
                type: 'image',
                timestamp: Date.now(),
                projectId: currentProjectId,
                meta: JSON.stringify({ source: 'typography_layer', fontId, text }),
                tags: ['typography_layer', fontId],
                origin: 'canvas-export'
            });
            setResult({ dataUrl: raster.dataUrl, width: raster.width, height: raster.height, svgPathD: vector.svgPathD, advanceWidth: vector.advanceWidth, text, fontId });
        } catch (err) {
            logger.error('[TypographyPanel] render failed', err);
            setError(err instanceof Error ? err.message : 'Render failed');
        }
    }, [text, fontId, fontSize, fill, letterSpacing]);

    return (
        <div data-testid="typography-panel" className="space-y-4">
            <h3 className="text-sm font-semibold">Typography</h3>

            <label className="block text-xs text-gray-500">
                Upload font (.ttf/.otf)
                <input
                    type="file"
                    accept=".ttf,.otf"
                    data-testid="font-upload"
                    onChange={e => void handleUpload(e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-xs"
                />
            </label>

            <label className="block text-xs text-gray-500">
                Font
                <select value={fontId} data-testid="font-select" onChange={e => setFontId(e.target.value)} className="mt-1 block w-full border rounded p-1 text-xs">
                    {fonts.length === 0 && <option value="">No fonts uploaded</option>}
                    {fonts.map(f => <option key={f.id} value={f.id}>{f.family || f.id}</option>)}
                </select>
            </label>

            <label className="block text-xs text-gray-500">
                Text
                <input value={text} data-testid="text-input" onChange={e => setText(e.target.value)} className="mt-1 block w-full border rounded p-1 text-xs" />
            </label>

            <div className="flex gap-2">
                <label className="text-xs text-gray-500">
                    Size <input type="number" value={fontSize} data-testid="size-input" onChange={e => setFontSize(Math.max(1, Number(e.target.value)))} className="w-16 border rounded p-1" />
                </label>
                <label className="text-xs text-gray-500">
                    Tracking <input type="number" value={letterSpacing} onChange={e => setLetterSpacing(Number(e.target.value))} className="w-16 border rounded p-1" />
                </label>
                <label className="text-xs text-gray-500">
                    Color <input type="color" value={fill} data-testid="color-input" onChange={e => setFill(e.target.value)} className="h-8 w-10 border rounded" />
                </label>
            </div>

            <button data-testid="render-btn" onClick={() => void handleRender()} className="rounded bg-purple-600 px-3 py-1 text-xs font-semibold text-white">
                Render wordmark
            </button>

            {error && <p className="text-xs text-red-600" data-testid="error">{error}</p>}
            {result && (
                <div data-testid="render-result" className="rounded border bg-black/5 p-2">
                    <img src={result.dataUrl} alt="Wordmark" className="max-w-full" />
                    <p className="mt-1 text-[10px] text-gray-500">{result.width}×{result.height} · advance {result.advanceWidth.toFixed(1)}</p>
                </div>
            )}
        </div>
    );
}
