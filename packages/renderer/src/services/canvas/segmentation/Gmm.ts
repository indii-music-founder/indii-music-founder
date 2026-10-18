/*!
 * Full-covariance Gaussian mixtures adapted from PhotoCraft's segment/gmm.rs.
 * Source commit bb3108cfd28a1cc84a9ae3b83531891f36a736fd.
 * Copyright (c) 2026 ArtCraft Team and the PhotoCraft contributors.
 * MIT license: ./PHOTOCRAFT-LICENSE.txt
 */
interface Gaussian { mean: Float64Array; inverse: Float64Array; logWeight: number }
const RIDGE = 2e-5;
function weightedLog(component: Gaussian, r: number, g: number, b: number): number {
    const x = r - component.mean[0]!, y = g - component.mean[1]!, z = b - component.mean[2]!, m = component.inverse;
    return component.logWeight - 0.5 * (x * (m[0]! * x + m[1]! * y + m[2]! * z) + y * (m[3]! * x + m[4]! * y + m[5]! * z) + z * (m[6]! * x + m[7]! * y + m[8]! * z));
}
function accumulate(stats: Float64Array, r: number, g: number, b: number, weight: number): void {
    stats[0] += weight; stats[1] += r * weight; stats[2] += g * weight; stats[3] += b * weight;
    const v = [r, g, b];
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) stats[4 + x * 3 + y] += weight * v[x]! * v[y]!;
}
function componentsFromStats(stats: Float64Array[], total: number): Gaussian[] {
    const result: Gaussian[] = [];
    for (const s of stats) {
        const count = s[0]!;
        if (!count) continue;
        const mean = new Float64Array([s[1]! / count, s[2]! / count, s[3]! / count]);
        const c = new Float64Array(9);
        for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) c[x * 3 + y] = s[4 + x * 3 + y]! / count - mean[x]! * mean[y]! + (x === y ? RIDGE : 0);
        const [a, b, d, e, f, g, h, i, j] = c as unknown as [number, number, number, number, number, number, number, number, number];
        const determinant = a * (f * j - g * i) - b * (e * j - g * h) + d * (e * i - f * h);
        if (determinant <= 1e-30) continue;
        const inverse = new Float64Array([
            f * j - g * i, d * i - b * j, b * g - d * f,
            g * h - e * j, a * j - d * h, d * e - a * g,
            e * i - f * h, b * h - a * i, a * f - b * e,
        ]).map(value => value / determinant);
        result.push({ mean, inverse, logWeight: Math.log(count / total) - 0.5 * Math.log(determinant) - 1.5 * Math.log(2 * Math.PI) });
    }
    if (!result.length) throw new Error('Cutout needs both foreground and background samples');
    return result;
}

export class ColorMixture {
    constructor(private components: Gaussian[]) {}
    logLikelihood(r: number, g: number, b: number): number {
        const logs = this.components.map(component => weightedLog(component, r, g, b));
        const maximum = Math.max(...logs);
        return maximum + Math.log(logs.reduce((sum, value) => sum + Math.exp(value - maximum), 0));
    }
    refit(samples: Float32Array): ColorMixture {
        const stats = this.components.map(() => new Float64Array(13));
        for (let i = 0; i < samples.length; i += 3) {
            const r = samples[i]!, g = samples[i + 1]!, b = samples[i + 2]!;
            let best = 0, score = -Infinity;
            for (let k = 0; k < this.components.length; k++) {
                const candidate = weightedLog(this.components[k]!, r, g, b);
                if (candidate > score) { best = k; score = candidate; }
            }
            accumulate(stats[best]!, r, g, b, 1);
        }
        return new ColorMixture(componentsFromStats(stats, samples.length / 3));
    }
    static fit(samples: Float32Array): ColorMixture {
        const count = samples.length / 3;
        if (!count || samples.length % 3) throw new Error('Cutout needs foreground and background samples');
        const centers: number[][] = [Array.from(samples.subarray(0, 3))];
        const distances = new Float64Array(count).fill(Infinity);
        let seed = 911;
        for (let k = 1; k < Math.min(5, count); k++) {
            const center = centers.at(-1)!;
            let total = 0;
            for (let i = 0; i < count; i++) {
                const distance = (samples[i * 3]! - center[0]!) ** 2 + (samples[i * 3 + 1]! - center[1]!) ** 2 + (samples[i * 3 + 2]! - center[2]!) ** 2;
                distances[i] = Math.min(distances[i]!, distance); total += distances[i]!;
            }
            if (total < 1e-12) break;
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            let target = seed / 0x100000000 * total, chosen = count - 1;
            for (let i = 0; i < count; i++) { target -= distances[i]!; if (target <= 0) { chosen = i; break; } }
            centers.push(Array.from(samples.subarray(chosen * 3, chosen * 3 + 3)));
        }
        let stats: Float64Array[] = [];
        for (let iteration = 0; iteration < 10; iteration++) {
            stats = centers.map(() => new Float64Array(13));
            for (let i = 0; i < samples.length; i += 3) {
                const r = samples[i]!, g = samples[i + 1]!, b = samples[i + 2]!;
                let best = 0, distance = Infinity;
                for (let k = 0; k < centers.length; k++) {
                    const c = centers[k]!, d = (r - c[0]!) ** 2 + (g - c[1]!) ** 2 + (b - c[2]!) ** 2;
                    if (d < distance) { best = k; distance = d; }
                }
                accumulate(stats[best]!, r, g, b, 1);
            }
            stats.forEach((s, k) => { if (s[0]) centers[k] = [s[1]! / s[0], s[2]! / s[0], s[3]! / s[0]]; });
        }
        let components = componentsFromStats(stats, count);
        for (let iteration = 0; iteration < 3; iteration++) {
            const stats = components.map(() => new Float64Array(13));
            for (let i = 0; i < samples.length; i += 3) {
                const r = samples[i]!, g = samples[i + 1]!, b = samples[i + 2]!;
                const logs = components.map(component => weightedLog(component, r, g, b));
                const maximum = Math.max(...logs), weights = logs.map(value => Math.exp(value - maximum));
                const total = weights.reduce((sum, value) => sum + value, 0);
                weights.forEach((value, k) => accumulate(stats[k]!, r, g, b, value / total));
            }
            components = componentsFromStats(stats, count);
        }
        return new ColorMixture(components);
    }
}
