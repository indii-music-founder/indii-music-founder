export interface MaskedTextCandidate {
    text: string;
    fontFamily: string;
    fill: string;
    background: string | null;
    italic: boolean;
    bold: boolean;
}

const FONTS = ['Arial', 'Georgia', 'Courier New', 'Times New Roman', 'Verdana', 'Tahoma', 'Trebuchet MS'];
const COLORS = 'black|white|red|blue|green|yellow|orange|purple|cyan|magenta';

/** Copy possible literal text from the request; a semantic judgment must approve it before rendering. */
export function maskedTextCandidates(prompt: string): MaskedTextCandidate[] {
    if (!/\b(?:text|words?|letters?|character|label|caption|lettering|type|write|reading|reads|saying)\b/i.test(prompt) &&
        !/^\s*(?:add|put|place|print)\s+["'“‘]/i.test(prompt)) return [];
    const texts: string[] = [];
    const quoted = /"([^"\n]{1,256})"|“([^”\n]{1,256})”|'([^'\n]{1,256})'|‘([^’\n]{1,256})’/g;
    for (const match of prompt.matchAll(quoted)) texts.push(match.slice(1).find(value => value !== undefined)!);
    const letters = /\b(?:(upper|lower)case\s+)?(?:letter|character)\s+["'“‘]?([\p{L}\p{N}])["'”’]?(?=$|[\s.,;:!?])/giu;
    for (const match of prompt.matchAll(letters)) {
        const letter = match[2]!;
        texts.push(match[1]?.toLowerCase() === 'upper' ? letter.toUpperCase() :
            match[1]?.toLowerCase() === 'lower' ? letter.toLowerCase() : letter);
    }
    const fonts = FONTS.filter(font => new RegExp(`\\b${font.replace(/ /g, '\\s+')}\\b`, 'i').test(prompt));
    const foreground = prompt.match(new RegExp(`\\b(${COLORS})\\s+(?:[\\p{L}-]+\\s+){0,3}(?:lettering|text|letters|font)\\b`, 'iu'))?.[1] ||
        prompt.match(new RegExp(`\\bin\\s+(${COLORS})(?=$|[\\s.,;:!?])`, 'i'))?.[1] || 'auto';
    const background = prompt.match(new RegExp(`\\bbackground\\s+(?:(?:is|stays?|remains?|to|as)\\s+)?(${COLORS})\\b`, 'i'))?.[1] ||
        prompt.match(new RegExp(`\\b(?:on|with)\\s+(?:a\\s+)?(${COLORS})\\s+background\\b`, 'i'))?.[1] || null;
    const candidates: MaskedTextCandidate[] = [];
    for (const text of new Set(texts)) {
        if (!text.trim() || Array.from(text).some(character => { const code = character.codePointAt(0)!; return code < 32 || code === 127; })) continue;
        for (const fontFamily of fonts.length ? fonts : ['Arial']) {
            candidates.push({ text, fontFamily, fill: foreground.toLowerCase(), background: background?.toLowerCase() || null,
                italic: /\bitalic\b/i.test(prompt), bold: /\bbold\b/i.test(prompt) });
            if (candidates.length === 8) return candidates;
        }
    }
    return candidates;
}

export interface TextMaskBounds { left: number; top: number; width: number; height: number; }

/** Bounds of the actual binary selection, excluding transparent or non-white pixels. */
export function textMaskBounds(mask: Uint8ClampedArray, width: number, height: number): TextMaskBounds | null {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || mask.length !== width * height * 4) {
        throw new Error('Invalid text mask dimensions.');
    }
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        if (Math.min(mask[index]!, mask[index + 1]!, mask[index + 2]!, mask[index + 3]!) < 128) continue;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Pick the more legible monochrome fill when the request leaves color unspecified. */
export function textContrastColor(source: Uint8ClampedArray, mask: Uint8ClampedArray): 'black' | 'white' {
    if (source.length !== mask.length || source.length % 4) throw new Error('Text contrast pixel dimensions do not match.');
    const linear = (value: number) => value / 255 <= 0.04045 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4;
    let luminance = 0, count = 0;
    for (let index = 0; index < mask.length; index += 4) {
        if (Math.min(mask[index]!, mask[index + 1]!, mask[index + 2]!, mask[index + 3]!) < 128) continue;
        luminance += 0.2126 * linear(source[index]!) + 0.7152 * linear(source[index + 1]!) + 0.0722 * linear(source[index + 2]!);
        count++;
    }
    if (!count) throw new Error('Paint an area before choosing text contrast.');
    const level = luminance / count;
    return (level + 0.05) / 0.05 >= 1.05 / (level + 0.05) ? 'black' : 'white';
}

/** Do not silently clip away lettering when the painted region has gaps or is too thin. */
export function textFitsMask(glyph: Uint8ClampedArray, mask: Uint8ClampedArray): boolean {
    if (glyph.length !== mask.length || glyph.length % 4) throw new Error('Text coverage pixel dimensions do not match.');
    let total = 0, retained = 0;
    for (let index = 0; index < glyph.length; index += 4) {
        const alpha = glyph[index + 3]!;
        if (!alpha) continue;
        total += alpha;
        retained += alpha * Math.min(mask[index]!, mask[index + 1]!, mask[index + 2]!) / 255 * mask[index + 3]! / 255;
    }
    return total > 0 && retained / total >= 0.995;
}
