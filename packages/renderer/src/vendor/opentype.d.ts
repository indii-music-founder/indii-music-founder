/**
 * Minimal ambient typings for opentype.js v2 (ships no bundled .d.ts).
 * Declares only the subset used by the typography pipeline (Workstream B1).
 */
declare module 'opentype.js' {
  export interface PathCommand { type: string; x?: number; y?: number; x1?: number; x2?: number; y1?: number; y2?: number; }

  export class Path {
    moves: Path[];
    commands: PathCommand[];
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    curveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void;
    quadTo(x1: number, y1: number, x: number, y: number): void;
    close(): void;
    toPathData(decimalPlaces?: number): string;
  }

  export interface GlyphOptions {
    name?: string;
    unicode?: number;
    advanceWidth?: number;
    path?: Path;
    index?: number;
  }

  export class Glyph {
    constructor(options: GlyphOptions);
    name: string;
    unicode: number;
    advanceWidth: number;
    path: Path;
    index?: number;
  }

  export interface FontOptions {
    familyName: string;
    styleName: string;
    unitsPerEm?: number;
    ascender?: number;
    descender?: number;
    glyphs?: Glyph[];
  }

  export interface GlyphPathOptions {
    kerning?: boolean;
    letterSpacing?: number;
  }

  export class Font {
    constructor(options: FontOptions);
    familyName: string;
    styleName: string;
    unitsPerEm: number;
    ascender: number;
    descender: number;
    glyphs: Glyph[];
    kerningPairs: Record<string, number> | undefined;
    forEachGlyph(text: string, callback: (glyph: Glyph, index: number, x: number) => void, x?: number, fontSize?: number, options?: GlyphPathOptions): void;
    getPath(text: string, x: number, y: number, fontSize: number, options?: GlyphPathOptions): Path;
    getAdvanceWidth(text: string, fontSize: number, options?: GlyphPathOptions): number;
    getKerningValue(left: string | Glyph, right: string | Glyph): number;
    toArrayBuffer(): ArrayBuffer;
  }

  export function parse(buffer: ArrayBuffer): Font;
  export function load(url: string): Promise<Font>; // browser
}
