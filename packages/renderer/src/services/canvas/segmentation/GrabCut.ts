/*!
 * Guided foreground extraction adapted from PhotoCraft segment/grabcut.rs.
 * Source commit bb3108cfd28a1cc84a9ae3b83531891f36a736fd.
 * Copyright (c) 2026 ArtCraft Team and the PhotoCraft contributors.
 * MIT license: ./PHOTOCRAFT-LICENSE.txt
 */
import { CutGraph } from './MaxFlow';
import { ColorMixture } from './Gmm';
export interface CutoutPoint { x: number; y: number }
export interface CutoutStroke { label: 'keep' | 'remove'; radius: number; points: CutoutPoint[] }
export interface CutoutRectangle { x: number; y: number; width: number; height: number }
export interface CutoutInput { width: number; height: number; pixels: Uint8ClampedArray; rectangle: CutoutRectangle; strokes: CutoutStroke[] }
interface Grid { width: number; height: number; colors: Float32Array; labels: Uint8Array; opaque?: Uint8Array }
const BG = 0, FG = 1, PROBABLE_BG = 2, PROBABLE_FG = 3;
const foreground = (label: number) => label === FG || label === PROBABLE_FG;
function paint(labels: Uint8Array, width: number, height: number, scale: number, strokes: CutoutStroke[]) {
    for (const stroke of strokes) {
        const radius = Math.max(stroke.radius / scale, 0.75), label = stroke.label === 'keep' ? FG : BG;
        let previous: CutoutPoint | null = null;
        for (const point of stroke.points) {
            const from = previous ?? point;
            const length = Math.hypot(point.x - from.x, point.y - from.y);
            const segments = Math.max(1, Math.ceil(length / Math.max(1, stroke.radius / 2)));
            for (let segment = 0; segment <= segments; segment++) {
                const x = (from.x + (point.x - from.x) * segment / segments) / scale;
                const y = (from.y + (point.y - from.y) * segment / segments) / scale;
                for (let row = Math.max(0, Math.floor(y - radius)); row <= Math.min(height - 1, Math.ceil(y + radius)); row++) {
                    for (let col = Math.max(0, Math.floor(x - radius)); col <= Math.min(width - 1, Math.ceil(x + radius)); col++) {
                        if ((col + 0.5 - x) ** 2 + (row + 0.5 - y) ** 2 <= radius ** 2) labels[row * width + col] = label;
                    }
                }
            }
            previous = point;
        }
    }
}
function samples(grid: Grid, isForeground: boolean): Float32Array {
    let count = 0;
    for (let i = 0; i < grid.labels.length; i++) if ((!grid.opaque || grid.opaque[i]) && foreground(grid.labels[i]!) === isForeground) count++;
    if (!count) throw new Error('Mark some pixels to keep and some to remove, then try again');
    const stride = Math.max(1, Math.ceil(count / 40_000));
    const result = new Float32Array(Math.ceil(count / stride) * 3);
    let seen = 0, offset = 0;
    for (let i = 0; i < grid.labels.length; i++) {
        if ((grid.opaque && !grid.opaque[i]) || foreground(grid.labels[i]!) !== isForeground) continue;
        if (seen++ % stride) continue;
        result[offset++] = grid.colors[i * 3]!; result[offset++] = grid.colors[i * 3 + 1]!; result[offset++] = grid.colors[i * 3 + 2]!;
    }
    return result.subarray(0, offset);
}
function cut(grid: Grid, fg: ColorMixture, bg: ColorMixture, graph: CutGraph): Uint8Array {
    const { width, height, colors, labels } = grid;
    const distance = (a: number, b: number) => (colors[a * 3]! - colors[b * 3]!) ** 2 + (colors[a * 3 + 1]! - colors[b * 3 + 1]!) ** 2 + (colors[a * 3 + 2]! - colors[b * 3 + 2]!) ** 2;
    let sum = 0, colorPairs = 0;
    const neighbors = [[1, 0], [0, 1], [1, 1], [-1, 1]] as const;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        for (const [dx, dy] of neighbors) if (x + dx >= 0 && x + dx < width && y + dy < height) {
            const from = y * width + x, to = (y + dy) * width + x + dx;
            if (!grid.opaque || (grid.opaque[from] && grid.opaque[to])) { sum += distance(from, to); colorPairs++; }
        }
    }
    const beta = sum > 1e-12 ? colorPairs / (2 * sum) : 0;
    graph.reset(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const node = y * width + x, label = labels[node]!;
        if (label === BG || (grid.opaque && !grid.opaque[node])) graph.terminals(node, 0, 1_000_000);
        else if (label === FG) graph.terminals(node, 1_000_000, 0);
        else {
            const r = colors[node * 3]!, g = colors[node * 3 + 1]!, b = colors[node * 3 + 2]!;
            const fgCost = -fg.logLikelihood(r, g, b), bgCost = -bg.logLikelihood(r, g, b), common = Math.min(fgCost, bgCost);
            graph.terminals(node, Math.min(10_000, bgCost - common), Math.min(10_000, fgCost - common));
        }
        for (const [dx, dy] of neighbors) if (x + dx >= 0 && x + dx < width && y + dy < height) {
            const other = (y + dy) * width + x + dx;
            const weight = grid.opaque && (!grid.opaque[node] || !grid.opaque[other]) ? 0 : 50 * Math.exp(-beta * distance(node, other)) / Math.hypot(dx, dy);
            graph.edge(node, other, weight, weight);
        }
    }
    graph.maxFlow();
    return Uint8Array.from(labels, (_, node) => graph.inSource(node) ? 1 : 0);
}

/** Model-free rectangle + trimap extraction, refined in bounded native-resolution tiles. */
export function extractCutout(input: CutoutInput, progress: (fraction: number) => void = () => undefined): Uint8Array {
    const { width, height, pixels, rectangle, strokes } = input;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || width * height > 24_000_000 || pixels.length !== width * height * 4) throw new Error('Cutout photo dimensions are invalid or exceed 24 megapixels');
    if (![rectangle.x, rectangle.y, rectangle.width, rectangle.height].every(Number.isFinite) || rectangle.width < 2 || rectangle.height < 2) throw new Error('Draw a box around the artist first');
    if (strokes.length > 1000 || strokes.some(stroke => stroke.points.length > 10_000 || !Number.isFinite(stroke.radius) || stroke.radius < 1 || stroke.radius > 1000 || stroke.points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y)))) throw new Error('Cutout refinement strokes exceed the supported limits');
    let step = Math.max(1, Math.ceil(Math.sqrt(width * height / 200_000)));
    while (Math.ceil(width / step) * Math.ceil(height / step) > 200_000) step++;
    const lowW = Math.ceil(width / step), lowH = Math.ceil(height / step);
    // A single graph serves every coarse iteration and native boundary tile.
    // Keep capacity bounded by the largest grid, rather than relying on GC between cuts.
    const tileW = Math.min(width, 512), tileH = Math.min(height, 512);
    const pairs = (w: number, h: number) => (w - 1) * h + (h - 1) * w + 2 * (w - 1) * (h - 1);
    const graph = new CutGraph(Math.max(lowW * lowH, tileW * tileH), Math.max(pairs(lowW, lowH), pairs(tileW, tileH)));
    const grid: Grid = { width: lowW, height: lowH, colors: new Float32Array(lowW * lowH * 3), labels: new Uint8Array(lowW * lowH), opaque: new Uint8Array(lowW * lowH) };
    for (let y = 0; y < lowH; y++) for (let x = 0; x < lowW; x++) {
        const sx = Math.min(width - 1, Math.floor((x + 0.5) * step)), sy = Math.min(height - 1, Math.floor((y + 0.5) * step)), node = y * lowW + x, source = (sy * width + sx) * 4;
        for (let channel = 0; channel < 3; channel++) grid.colors[node * 3 + channel] = pixels[source + channel]! / 255;
        grid.opaque![node] = pixels[source + 3] ? 1 : 0;
        grid.labels[node] = sx >= rectangle.x && sy >= rectangle.y && sx < rectangle.x + rectangle.width && sy < rectangle.y + rectangle.height && pixels[source + 3] ? PROBABLE_FG : BG;
        // A full-image rectangle still needs a background ring for an initial model.
        if (!x || !y || x === lowW - 1 || y === lowH - 1) grid.labels[node] = BG;
    }
    paint(grid.labels, lowW, lowH, step, strokes);
    let fg: ColorMixture | null = null, bg: ColorMixture | null = null;
    let result: Uint8Array = new Uint8Array(lowW * lowH);
    for (let iteration = 0; iteration < 8; iteration++) {
        const foregroundSamples = samples(grid, true), backgroundSamples = samples(grid, false);
        fg = fg ? fg.refit(foregroundSamples) : ColorMixture.fit(foregroundSamples);
        bg = bg ? bg.refit(backgroundSamples) : ColorMixture.fit(backgroundSamples);
        result = cut(grid, fg, bg, graph);
        let changed = 0;
        for (let i = 0; i < grid.labels.length; i++) {
            if (grid.labels[i] === BG || grid.labels[i] === FG) continue;
            const next = result[i] ? PROBABLE_FG : PROBABLE_BG;
            if (grid.labels[i] !== next) changed++;
            grid.labels[i] = next;
        }
        progress(0.05 + (iteration + 1) / 8 * 0.5);
        if (changed * 2000 < grid.labels.length) break;
    }
    if (!fg || !bg) throw new Error('Cutout color models could not be fitted');
    const mask = new Uint8Array(width * height);
    const lowAt = (x: number, y: number) => result[Math.min(lowH - 1, Math.max(0, Math.floor(y / step))) * lowW + Math.min(lowW - 1, Math.max(0, Math.floor(x / step)))]!;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) mask[y * width + x] = lowAt(x, y) ? 255 : 0;
    if (step > 1) {
        const boundary = new Uint8Array(lowW * lowH);
        for (let y = 0; y < lowH; y++) for (let x = 0; x < lowW; x++) {
            const node = y * lowW + x;
            if ((x + 1 < lowW && result[node] !== result[node + 1]) || (y + 1 < lowH && result[node] !== result[node + lowW])) {
                for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (x + dx >= 0 && x + dx < lowW && y + dy >= 0 && y + dy < lowH) boundary[(y + dy) * lowW + x + dx] = 1;
            }
        }
        const tileSize = 448, halo = 32, columns = Math.ceil(width / tileSize), rows = Math.ceil(height / tileSize);
        for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
            const x0 = Math.max(0, col * tileSize - halo), y0 = Math.max(0, row * tileSize - halo);
            const x1 = Math.min(width, (col + 1) * tileSize + halo), y1 = Math.min(height, (row + 1) * tileSize + halo);
            const tw = x1 - x0, th = y1 - y0;
            let required = false;
            for (let y = y0; y < y1 && !required; y += step) for (let x = x0; x < x1; x += step) if (boundary[Math.floor(y / step) * lowW + Math.floor(x / step)]) { required = true; break; }
            if (required) {
                const tile: Grid = { width: tw, height: th, colors: new Float32Array(tw * th * 3), labels: new Uint8Array(tw * th), opaque: new Uint8Array(tw * th) };
                for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
                    const sx = x0 + x, sy = y0 + y, node = y * tw + x, source = (sy * width + sx) * 4;
                    for (let channel = 0; channel < 3; channel++) tile.colors[node * 3 + channel] = pixels[source + channel]! / 255;
                    tile.opaque![node] = pixels[source + 3] ? 1 : 0;
                    const edge = boundary[Math.floor(sy / step) * lowW + Math.floor(sx / step)];
                    tile.labels[node] = !pixels[source + 3] ? BG : edge && x && y && x < tw - 1 && y < th - 1 ? (lowAt(sx, sy) ? PROBABLE_FG : PROBABLE_BG) : (lowAt(sx, sy) ? FG : BG);
                }
                paint(tile.labels, tw, th, 1, strokes.map(stroke => ({ ...stroke, points: stroke.points.map(point => ({ x: point.x - x0, y: point.y - y0 })) })));
                const refined = cut(tile, fg, bg, graph);
                for (let sy = row * tileSize; sy < Math.min(height, (row + 1) * tileSize); sy++) for (let sx = col * tileSize; sx < Math.min(width, (col + 1) * tileSize); sx++) mask[sy * width + sx] = refined[(sy - y0) * tw + sx - x0] ? 255 : 0;
            }
            progress(0.55 + ((row * columns + col + 1) / (rows * columns)) * 0.4);
        }
    }
    // Native-resolution brush seeds remain authoritative, including away from boundaries.
    const hard = new Uint8Array(width * height).fill(PROBABLE_BG);
    paint(hard, width, height, 1, strokes);
    for (let i = 0; i < mask.length; i++) {
        if (!pixels[i * 4 + 3] || hard[i] === BG) mask[i] = 0;
        else if (hard[i] === FG) mask[i] = 255;
    }
    progress(1);
    return mask;
}
