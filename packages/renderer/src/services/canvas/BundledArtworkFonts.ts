import { EMBEDDED_FONT_FACE_ASSETS } from '@indii/video-compiler/fontAssets';
import montserratLicense from './fontLicenses/montserrat-OFL.txt?url';
import archivoLicense from './fontLicenses/archivoblack-OFL.txt?url';
import monoLicense from './fontLicenses/spacemono-OFL.txt?url';
import type { TypographyLayer } from './CanvasDoc';

/** Reuse the app's pinned font bytes; no font download or new dependency. */
export const BUNDLED_ARTWORK_FONTS = [
    { id: 'builtin:montserrat', family: 'Montserrat', style: 'Bold', weight: 700, licenseUrl: montserratLicense },
    { id: 'builtin:archivo-black', family: 'Archivo Black', style: 'Black', weight: 400, licenseUrl: archivoLicense },
    { id: 'builtin:space-mono', family: 'Space Mono', style: 'Regular', weight: 400, licenseUrl: monoLicense },
] as const;
const loaded = new Map<string, Promise<string>>();
export const isBundledArtworkFont = (id: string) => BUNDLED_ARTWORK_FONTS.some(font => font.id === id);
const SUPPORTED_TEXT = /^[\x20-\x7e\u00a0-\u00ff\u0131\u0152\u0153\u02bb\u02bc\u02c6\u02da\u02dc\u2000-\u206f\u2074\u20ac\u2122\u2191\u2193\u2212\u2215]*$/u;

async function loadFont(id: string): Promise<string> {
    const font = BUNDLED_ARTWORK_FONTS.find(font => font.id === id);
    if (!font) throw new Error('Unknown bundled artwork font');
    const cached = loaded.get(id); if (cached) return cached;
    const pending = (async () => {
        const faces = EMBEDDED_FONT_FACE_ASSETS[font.family];
        const [range, base64] = Object.entries(faces ?? {}).find(([range]) => range === String(font.weight)) ?? Object.entries(faces ?? {})[0] ?? [];
        if (!base64 || !range) throw new Error(`The bundled ${font.family} font is unavailable`);
        const family = `IndiiArtwork${id.replace(/[^a-z]/gi, '')}`;
        const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
        const face = new FontFace(family, bytes.buffer, { weight: range });
        await face.load(); document.fonts.add(face);
        return family;
    })();
    loaded.set(id, pending);
    void pending.catch(() => { loaded.delete(id); });
    return pending;
}

/** Native glyph shaping uses the same pinned font and source bake for preview/export. */
export async function renderBundledArtworkText(t: TypographyLayer, scale: number) {
    if (!Array.from(t.text).every(character => SUPPORTED_TEXT.test(character) || ['\u0304', '\u0308', '\u0329'].includes(character))) throw new Error('This bundled font supports Latin lettering. These characters need another font.');
    const font = BUNDLED_ARTWORK_FONTS.find(font => font.id === t.fontId)!;
    const family = await loadFont(t.fontId);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Text rendering is unavailable');
    const configure = () => {
        ctx.font = `${font.weight} ${t.fontSize}px "${family}"`;
        ctx.fontKerning = t.kerning ? 'normal' : 'none';
        ctx.letterSpacing = `${t.letterSpacing}px`;
        ctx.textBaseline = 'alphabetic';
    };
    configure();
    const metrics = ctx.measureText(t.text), padding = 2 + (t.stroke?.width ?? 0);
    const left = Math.max(0, metrics.actualBoundingBoxLeft), ascent = metrics.actualBoundingBoxAscent;
    const width = Math.max(1, Math.ceil((Math.max(metrics.width, left + metrics.actualBoundingBoxRight) + padding * 2) * scale));
    const height = Math.max(1, Math.ceil((ascent + metrics.actualBoundingBoxDescent + padding * 2) * scale));
    if (!Number.isFinite(scale) || scale <= 0 || width > 16384 || height > 16384 || width * height > 24_000_000) throw new Error('Text is too large. Reduce its size or layer scale.');
    canvas.width = width; canvas.height = height; configure(); ctx.scale(scale, scale);
    const x = padding + left, y = padding + ascent;
    if (t.stroke && t.stroke.width > 0) { ctx.strokeStyle = t.stroke.color; ctx.lineWidth = t.stroke.width; ctx.strokeText(t.text, x, y); }
    ctx.fillStyle = t.fill; ctx.fillText(t.text, x, y);
    return { dataUrl: canvas.toDataURL('image/png'), width, height };
}
